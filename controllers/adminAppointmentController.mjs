import pool, { withTransaction } from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { paginated, parsePagination, parseId } from '../utils/http.mjs';

export const APPOINTMENT_STATUSES = ['Booked', 'Called', 'Converted', 'Cancelled', 'Completed', 'No Show'];

const TRANSITIONS = {
    Booked: ['Called', 'Cancelled', 'Completed', 'No Show'],
    Called: ['Converted', 'Cancelled', 'Completed', 'No Show'],
    Converted: [],
    Completed: [],
    Cancelled: ['Booked'],
    'No Show': ['Booked'],
};

export const getAllAppointments = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const filters = [];
    const params = [];

    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    if (status) {
        if (!APPOINTMENT_STATUSES.includes(status)) {
            throw ApiError.badRequest(`Invalid status filter. Allowed: ${APPOINTMENT_STATUSES.join(', ')}`);
        }
        params.push(status);
        filters.push(`a.status = $${params.length}`);
    }

    if (req.query.from) {
        const from = new Date(req.query.from);
        if (Number.isNaN(from.getTime())) throw ApiError.badRequest('Invalid "from" date');
        params.push(from.toISOString());
        filters.push(`a.appointment_date >= $${params.length}`);
    }

    if (req.query.to) {
        const to = new Date(req.query.to);
        if (Number.isNaN(to.getTime())) throw ApiError.badRequest('Invalid "to" date');
        params.push(to.toISOString());
        filters.push(`a.appointment_date <= $${params.length}`);
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
        params.push(`%${search}%`);
        filters.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const direction = req.query.order === 'asc' ? 'ASC' : 'DESC';

    params.push(limit, offset);
    const rows = await pool.query(
        `SELECT a.id, a.appointment_date, a.status, a.notes, a.created_at, a.updated_at,
                u.id AS user_id, u.full_name, u.email, u.phone_number, u.state_hometown,
                u.choice_of_stream, u.entry_level
         FROM appointments a
         JOIN users u ON a.user_id = u.id
         ${where}
         ORDER BY a.appointment_date ${direction}, a.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    const total = await pool.query(
        `SELECT count(*)::int AS total
         FROM appointments a JOIN users u ON a.user_id = u.id
         ${where}`,
        params.slice(0, -2)
    );

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export const getAppointmentHistory = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Appointment id');
    const rows = await pool.query(
        `SELECT h.id, h.from_status, h.to_status, h.note, h.created_at, u.full_name AS changed_by_name
         FROM appointment_status_history h
         LEFT JOIN users u ON u.id = h.changed_by
         WHERE h.appointment_id = $1
         ORDER BY h.created_at ASC, h.id ASC`,
        [id]
    );
    return res.json(rows.rows);
});

export const updateAppointmentStatus = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Appointment id');
    const { status, note } = req.body;

    if (!APPOINTMENT_STATUSES.includes(status)) {
        throw ApiError.badRequest(`Invalid status. Allowed: ${APPOINTMENT_STATUSES.join(', ')}`);
    }

    const updated = await withTransaction(async (client) => {
        const current = await client.query(
            'SELECT id, status FROM appointments WHERE id = $1 FOR UPDATE',
            [id]
        );
        const row = current.rows[0];
        if (!row) throw ApiError.notFound('Appointment not found');

        if (row.status !== status) {
            const allowed = TRANSITIONS[row.status] ?? [];
            if (!allowed.includes(status)) {
                throw ApiError.conflict(
                    `Cannot change status from "${row.status}" to "${status}". Allowed next values: ${
                        allowed.length ? allowed.join(', ') : 'none (terminal state)'
                    }`
                );
            }
        }

        // Re-booking a cancelled slot must not collide with an existing booking.
        const result = await client.query(
            'UPDATE appointments SET status = $1 WHERE id = $2 RETURNING id, status, appointment_date',
            [status, id]
        );

        if (row.status !== status) {
            await client.query(
                `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, changed_by, note)
                 VALUES ($1, $2, $3, $4, $5)`,
                [id, row.status, status, req.user.id, note ?? null]
            );
        }

        return result.rows[0];
    });

    return res.json(updated);
});
