import pool, { withTransaction } from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { paginated, parsePagination, parseId } from '../utils/http.mjs';
import { revokeUserSessions } from '../utils/sessionStore.mjs';

const VALID_ROLES = ['user', 'agent', 'admin'];
const REFERRAL_TRANSITIONS = {
    'Not Referred': ['Referred'],
    Referred: ['Converted', 'Not Referred'],
    Converted: [],
};

export const getAllUsers = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';

    if (role && !VALID_ROLES.includes(role)) {
        throw ApiError.badRequest(`Invalid role filter. Allowed: ${VALID_ROLES.join(', ')}`);
    }

    const filters = [];
    const params = [];
    if (search) {
        params.push(`%${search}%`);
        filters.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone_number ILIKE $${params.length})`);
    }
    if (role) {
        params.push(role);
        filters.push(`role = $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    params.push(limit, offset);
    const rows = await pool.query(
        `SELECT id, full_name, email, role, phone_number, state_hometown, referral_status, referred_by, created_at
         FROM users ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    const totalResult = await pool.query(`SELECT count(*)::int AS total FROM users ${where}`, params.slice(0, -2));

    return res.json(paginated(rows.rows, { page, limit }, totalResult.rows[0].total));
});

export const updateUserRole = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'User id');
    const { role } = req.body;

    if (!VALID_ROLES.includes(role)) {
        throw ApiError.badRequest(`Invalid role. Allowed: ${VALID_ROLES.join(', ')}`);
    }
    if (id === req.user.id && role !== 'admin') {
        throw ApiError.badRequest('You cannot demote your own admin account');
    }

    const updated = await withTransaction(async (client) => {
        const target = await client.query('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [id]);
        if (target.rows.length === 0) throw ApiError.notFound('User not found');

        const currentRole = target.rows[0].role;
        if (currentRole === role) return { id, role, changed: false };

        if (currentRole === 'admin' && role !== 'admin') {
            const admins = await client.query(
                `SELECT count(*)::int AS count FROM users WHERE role = 'admin' AND id <> $1`,
                [id]
            );
            if (admins.rows[0].count === 0) {
                throw ApiError.conflict('Cannot demote the last remaining administrator');
            }
        }

        const result = await client.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, role',
            [role, id]
        );
        return { ...result.rows[0], changed: true };
    });

    // Role changes must invalidate already-issued sessions immediately.
    let sessionsRevoked = 0;
    if (updated.changed) {
        sessionsRevoked = await revokeUserSessions(updated.id, 'role-changed');
    }

    return res.json({ id: updated.id, role: updated.role, sessionsRevoked });
});

export const getAllAgents = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const rows = await pool.query(
        `SELECT a.id, a.full_name, a.email, a.phone_number, COUNT(r.id)::int AS referral_count
         FROM users a
         LEFT JOIN users r ON a.id = r.referred_by
         WHERE a.role = 'agent'
         GROUP BY a.id
         ORDER BY a.full_name, a.id
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    const total = await pool.query(`SELECT count(*)::int AS total FROM users WHERE role = 'agent'`);

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export const getAgentDetails = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Agent id');

    const agentResult = await pool.query(
        `SELECT id, full_name, email FROM users WHERE id = $1 AND role = 'agent'`,
        [id]
    );
    if (agentResult.rows.length === 0) throw ApiError.notFound('Agent not found');

    const referrals = await pool.query(
        `SELECT id, full_name, email, referral_status, created_at
         FROM users WHERE referred_by = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 500`,
        [id]
    );

    return res.json({ agent: agentResult.rows[0], referrals: referrals.rows });
});

export const updateReferralStatus = asyncHandler(async (req, res) => {
    const referralId = parseId(req.params.referralId, 'Referral id');
    const { status } = req.body;

    if (!Object.keys(REFERRAL_TRANSITIONS).includes(status)) {
        throw ApiError.badRequest(`Invalid status. Allowed: ${Object.keys(REFERRAL_TRANSITIONS).join(', ')}`);
    }

    const updated = await withTransaction(async (client) => {
        const current = await client.query(
            'SELECT id, referral_status, referred_by FROM users WHERE id = $1 FOR UPDATE',
            [referralId]
        );
        const row = current.rows[0];
        if (!row) throw ApiError.notFound('Referred user not found');
        if (!row.referred_by) {
            throw ApiError.unprocessable('This user has no referral, so a referral status cannot be set');
        }
        if (row.referral_status === status) return row;

        const allowed = REFERRAL_TRANSITIONS[row.referral_status] ?? [];
        if (!allowed.includes(status)) {
            throw ApiError.conflict(
                `Cannot change referral status from "${row.referral_status}" to "${status}". Allowed next values: ${
                    allowed.length ? allowed.join(', ') : 'none (terminal state)'
                }`
            );
        }

        const result = await client.query(
            'UPDATE users SET referral_status = $1 WHERE id = $2 RETURNING id, referral_status',
            [status, referralId]
        );
        return result.rows[0];
    });

    return res.json(updated);
});
