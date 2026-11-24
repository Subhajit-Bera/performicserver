import pool from '../config/db.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { paginated, parsePagination } from '../utils/http.mjs';

export const submitContactMessage = asyncHandler(async (req, res) => {
    const { name, email, phone, message } = req.body;

    const result = await pool.query(
        `INSERT INTO contact_messages (name, email, phone, message, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [name, email, phone ?? null, message, req.ip ?? null, req.get('user-agent') ?? null]
    );

    return res.status(201).json({
        id: result.rows[0].id,
        message: 'Thanks for reaching out. Our team will get back to you shortly.',
    });
});

export const listContactMessages = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const unhandledOnly = req.query.unhandled === 'true';

    const where = unhandledOnly ? 'WHERE handled_at IS NULL' : '';

    const rows = await pool.query(
        `SELECT id, name, email, phone, message, handled_at, created_at
         FROM contact_messages ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    const total = await pool.query(
        `SELECT count(*)::int AS total FROM contact_messages ${where}`
    );

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export const markContactMessageHandled = asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid message id');

    const result = await pool.query(
        `UPDATE contact_messages SET handled_at = now() WHERE id = $1 AND handled_at IS NULL
         RETURNING id, handled_at`,
        [id]
    );
    if (result.rows.length === 0) throw ApiError.notFound('Message not found or already handled');

    return res.json(result.rows[0]);
});
