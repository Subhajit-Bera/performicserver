import pool, { withTransaction } from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { paginated, parsePagination, parseId } from '../utils/http.mjs';
import { slugify } from '../utils/slugify.mjs';

const jsonb = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

const normalizeStreamIds = (value) =>
    [...new Set((value ?? []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];

export const getAllCoursesAdmin = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const filters = [];
    const params = [];
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
        params.push(`%${search}%`);
        filters.push(`c.name ILIKE $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    params.push(limit, offset);
    const rows = await pool.query(
        `SELECT c.id, c.name, c.slug, c.description, c.icon_name, c.created_at, c.updated_at,
                COALESCE(STRING_AGG(s.name, ', ' ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '') AS stream_names
         FROM courses c
         LEFT JOIN stream_courses sc ON sc.course_id = c.id
         LEFT JOIN streams s ON s.id = sc.stream_id
         ${where}
         GROUP BY c.id
         ORDER BY c.name ASC, c.id ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    const total = await pool.query(`SELECT count(*)::int AS total FROM courses c ${where}`, params.slice(0, -2));

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export const getCourseByIdAdmin = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Course id');
    const result = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (result.rows.length === 0) throw ApiError.notFound('Course not found');

    const course = result.rows[0];
    const streams = await pool.query(
        'SELECT stream_id FROM stream_courses WHERE course_id = $1 ORDER BY stream_id',
        [id]
    );
    course.stream_ids = streams.rows.map((r) => r.stream_id);

    return res.json(course);
});

export const createCourse = asyncHandler(async (req, res) => {
    const data = req.validatedBody ?? req.body;
    const slug = slugify(data.name);
    if (!slug) throw ApiError.badRequest('Course name must contain at least one alphanumeric character');

    const course = await withTransaction(async (client) => {
        const result = await client.query(
            'INSERT INTO courses (name, slug, description, icon_name) VALUES ($1, $2, $3, $4) RETURNING *',
            [data.name, slug, data.description ?? null, data.icon_name ?? null]
        );
        const created = result.rows[0];

        if (data.stream_ids !== undefined) {
            const streamIds = normalizeStreamIds(data.stream_ids);
            if (streamIds.length > 0) {
                await client.query(
                    'INSERT INTO stream_courses (stream_id, course_id) SELECT unnest($1::int[]), $2 ON CONFLICT DO NOTHING',
                    [streamIds, created.id]
                );
            }
        }

        return created;
    });

    return res.status(201).json(course);
});

export const updateCourse = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Course id');
    const data = req.validatedBody ?? req.body;
    const slug = slugify(data.name);
    if (!slug) throw ApiError.badRequest('Course name must contain at least one alphanumeric character');

    const course = await withTransaction(async (client) => {
        const result = await client.query(
            `UPDATE courses SET name=$1, slug=$2, description=$3, icon_name=$4, updated_at=now()
             WHERE id=$5 RETURNING *`,
            [data.name, slug, data.description ?? null, data.icon_name ?? null, id]
        );
        if (result.rows.length === 0) throw ApiError.notFound('Course not found');

        if (data.stream_ids !== undefined) {
            const streamIds = normalizeStreamIds(data.stream_ids);
            await client.query('DELETE FROM stream_courses WHERE course_id = $1', [id]);
            if (streamIds.length > 0) {
                await client.query(
                    'INSERT INTO stream_courses (stream_id, course_id) SELECT unnest($1::int[]), $2 ON CONFLICT DO NOTHING',
                    [streamIds, id]
                );
            }
        }

        return result.rows[0];
    });

    return res.json(course);
});

export const deleteCourse = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Course id');
    const result = await pool.query('DELETE FROM courses WHERE id = $1', [id]);
    if (result.rowCount === 0) throw ApiError.notFound('Course not found');
    return res.status(204).send();
});
