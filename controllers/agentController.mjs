import pool from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { paginated, parsePagination, parseId } from '../utils/http.mjs';

const REFERRAL_TRANSITIONS = {
    'Not Referred': ['Referred'],
    Referred: ['Converted', 'Not Referred'],
    Converted: [],
};

export const searchUser = asyncHandler(async (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    const contact = typeof req.query.contact === 'string' ? req.query.contact.trim().toLowerCase() : '';

    if (name.length < 2 || !contact) {
        throw ApiError.badRequest('Name (min 2 characters) and contact (email/phone) are required');
    }

    const result = await pool.query(
        `SELECT id, full_name, email, phone_number, referred_by, referral_status
         FROM users
         WHERE role = 'user'
           AND full_name ILIKE $1
           AND (lower(email) = $2 OR phone_number = $3)
         ORDER BY full_name, id
         LIMIT 25`,
        [`%${name}%`, contact, contact]
    );

    return res.json(result.rows);
});

export const referUser = asyncHandler(async (req, res) => {
    const userId = parseId(req.body.userId, 'User id');
    const agentId = req.user.id;

    if (userId === agentId) throw ApiError.badRequest('You cannot refer yourself');

    // The role and "not already referred" checks are part of the same atomic
    // UPDATE, so a concurrent role change cannot slip past the validation.
    const result = await pool.query(
        `UPDATE users
         SET referred_by = $1, referral_status = 'Referred'
         WHERE id = $2
           AND role = 'user'
           AND referred_by IS NULL
           AND id <> $1
         RETURNING id, full_name, referred_by, referral_status`,
        [agentId, userId]
    );

    const referral = result.rows[0];
    if (!referral) {
        const existing = await pool.query('SELECT id, role, referred_by FROM users WHERE id = $1', [userId]);
        if (existing.rows.length === 0) throw ApiError.notFound('User not found');
        if (existing.rows[0].role !== 'user') {
            throw ApiError.badRequest('Only standard users can be referred');
        }
        throw ApiError.conflict('This user has already been referred');
    }

    return res.json(referral);
});

export const getMyReferrals = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const rows = await pool.query(
        `SELECT id, full_name, email, phone_number, whatsapp_number, choice_of_stream, referral_status, created_at
         FROM users WHERE referred_by = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
    );

    const total = await pool.query(`SELECT count(*)::int AS total FROM users WHERE referred_by = $1`, [req.user.id]);

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export { REFERRAL_TRANSITIONS };
