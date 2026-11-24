import pool, { withTransaction } from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { paginated, parsePagination, parseId } from '../utils/http.mjs';

export const APPLICATION_STATUSES = ['Applied', 'Called', 'Converted', 'Rejected'];

const TRANSITIONS = {
    Applied: ['Called', 'Rejected'],
    Called: ['Converted', 'Rejected'],
    Converted: [],
    Rejected: ['Applied'],
};

const SORTABLE = ['applied_at', 'status', 'full_name', 'university_name'];

export const getAllApplications = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const filters = [];
    const params = [];

    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    if (status) {
        if (!APPLICATION_STATUSES.includes(status)) {
            throw ApiError.badRequest(`Invalid status filter. Allowed: ${APPLICATION_STATUSES.join(', ')}`);
        }
        params.push(status);
        filters.push(`app.status = $${params.length}`);
    }

    const universityId = typeof req.query.universityId === 'string' && req.query.universityId.trim() !== ''
        ? parseId(req.query.universityId, 'universityId')
        : null;
    if (universityId) {
        params.push(universityId);
        filters.push(`app.university_id = $${params.length}`);
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
        params.push(`%${search}%`);
        filters.push(
            `(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR uni.name ILIKE $${params.length})`
        );
    }

    const sortField = SORTABLE.includes(req.query.sort) ? req.query.sort : 'applied_at';
    const sortColumn = sortField === 'full_name' ? 'u.full_name' : sortField === 'university_name' ? 'uni.name' : `app.${sortField}`;
    const direction = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    params.push(limit, offset);
    const rows = await pool.query(
        `SELECT app.id, app.status, app.course_name, app.applied_at, app.updated_at,
                u.id AS user_id, u.full_name, u.email, u.phone_number, u.state_hometown,
                uni.id AS university_id, uni.name AS university_name
         FROM applications app
         JOIN users u ON app.user_id = u.id
         JOIN universities uni ON app.university_id = uni.id
         ${where}
         ORDER BY ${sortColumn} ${direction}, app.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    const total = await pool.query(
        `SELECT count(*)::int AS total
         FROM applications app
         JOIN users u ON app.user_id = u.id
         JOIN universities uni ON app.university_id = uni.id
         ${where}`,
        params.slice(0, -2)
    );

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export const getApplicationHistory = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Application id');
    const rows = await pool.query(
        `SELECT h.id, h.from_status, h.to_status, h.note, h.created_at, u.full_name AS changed_by_name
         FROM application_status_history h
         LEFT JOIN users u ON u.id = h.changed_by
         WHERE h.application_id = $1
         ORDER BY h.created_at ASC, h.id ASC`,
        [id]
    );
    return res.json(rows.rows);
});

export const updateApplication = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Application id');
    const { status, course_name: courseName, note } = req.body;

    if (!status && courseName === undefined) {
        throw ApiError.badRequest('Provide status and/or course_name');
    }
    if (status && !APPLICATION_STATUSES.includes(status)) {
        throw ApiError.badRequest(`Invalid status. Allowed: ${APPLICATION_STATUSES.join(', ')}`);
    }
    if (courseName !== undefined && (typeof courseName !== 'string' || courseName.length > 255)) {
        throw ApiError.badRequest('course_name must be a string of 255 characters or fewer');
    }

    const updated = await withTransaction(async (client) => {
        const current = await client.query(
            'SELECT id, status FROM applications WHERE id = $1 FOR UPDATE',
            [id]
        );
        const row = current.rows[0];
        if (!row) throw ApiError.notFound('Application not found');

        if (status && status !== row.status) {
            const allowed = TRANSITIONS[row.status] ?? [];
            if (!allowed.includes(status)) {
                throw ApiError.conflict(
                    `Cannot change status from "${row.status}" to "${status}". Allowed next values: ${
                        allowed.length ? allowed.join(', ') : 'none (terminal state)'
                    }`
                );
            }
        }

        const result = await client.query(
            `UPDATE applications
             SET status = COALESCE($1, status),
                 course_name = COALESCE($2, course_name),
                 updated_by = $3
             WHERE id = $4
             RETURNING id, status, course_name, applied_at, updated_at`,
            [status ?? null, courseName ?? null, req.user.id, id]
        );

        if (status && status !== row.status) {
            await client.query(
                `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, note)
                 VALUES ($1, $2, $3, $4, $5)`,
                [id, row.status, status, req.user.id, note ?? null]
            );
        }

        return result.rows[0];
    });

    return res.json(updated);
});
