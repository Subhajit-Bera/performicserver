import pool, { withTransaction } from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { slugify } from '../utils/slugify.mjs';

export const getAllStreams = asyncHandler(async (_req, res) => {
    const result = await pool.query(`
        SELECT s.id, s.name, s.slug,
               COALESCE(json_agg(sc.course_id ORDER BY sc.course_id) FILTER (WHERE sc.course_id IS NOT NULL), '[]') AS course_ids
        FROM streams s
        LEFT JOIN stream_courses sc ON sc.stream_id = s.id
        GROUP BY s.id
        ORDER BY s.name ASC, s.id ASC
    `);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(result.rows);
});

export const createStream = asyncHandler(async (req, res) => {
    const { name } = req.validatedBody ?? req.body;
    const slug = slugify(name);
    if (!slug) throw ApiError.badRequest('Stream name must contain at least one alphanumeric character');

    const result = await pool.query(
        'INSERT INTO streams (name, slug) VALUES ($1, $2) RETURNING *',
        [name, slug]
    );
    return res.status(201).json(result.rows[0]);
});

export const updateStream = asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid stream id');

    const { name } = req.validatedBody ?? req.body;
    const slug = slugify(name);
    if (!slug) throw ApiError.badRequest('Stream name must contain at least one alphanumeric character');

    const result = await pool.query(
        'UPDATE streams SET name=$1, slug=$2, updated_at=now() WHERE id=$3 RETURNING *',
        [name, slug, id]
    );
    if (result.rows.length === 0) throw ApiError.notFound('Stream not found');
    return res.json(result.rows[0]);
});

export const deleteStream = asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid stream id');

    const result = await pool.query('DELETE FROM streams WHERE id = $1', [id]);
    if (result.rowCount === 0) throw ApiError.notFound('Stream not found');
    return res.status(204).send();
});

export const updateStreamCourses = asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid stream id');

    const { course_ids: courseIds = [] } = req.validatedBody ?? req.body;
    const unique = [...new Set(courseIds.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];

    const linked = await withTransaction(async (client) => {
        const stream = await client.query('SELECT id FROM streams WHERE id = $1', [id]);
        if (stream.rows.length === 0) throw ApiError.notFound('Stream not found');

        await client.query('DELETE FROM stream_courses WHERE stream_id = $1', [id]);
        if (unique.length > 0) {
            const inserted = await client.query(
                `INSERT INTO stream_courses (stream_id, course_id)
                 SELECT $1, c.id FROM courses c WHERE c.id = ANY($2::int[])
                 ON CONFLICT DO NOTHING
                 RETURNING course_id`,
                [id, unique]
            );
            if (inserted.rowCount !== unique.length) {
                throw ApiError.badRequest('One or more course ids do not exist');
            }
        }
        return unique;
    });

    return res.json({ message: 'Stream courses updated successfully.', course_ids: linked });
});
