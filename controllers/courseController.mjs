import pool from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';

export const getAllCourses = asyncHandler(async (_req, res) => {
    const result = await pool.query(
        'SELECT id, name, slug, description, icon_name FROM courses ORDER BY name ASC, id ASC'
    );
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(result.rows);
});

// Universities offering a course come from the normalized offerings table, with a
// legacy fallback that matches the denormalized courses_and_fees JSONB by course name.
export const getCourseBySlug = asyncHandler(async (req, res) => {
    const slug = (req.params.slug ?? '').trim();
    if (!slug) throw ApiError.badRequest('Invalid course slug');

    const courseResult = await pool.query(
        'SELECT id, name, slug, description, icon_name FROM courses WHERE slug = $1',
        [slug]
    );
    if (courseResult.rows.length === 0) throw ApiError.notFound('Course not found');
    const course = courseResult.rows[0];

    const streams = await pool.query(
        `SELECT s.id, s.name, s.slug
         FROM streams s
         JOIN stream_courses sc ON sc.stream_id = s.id
         WHERE sc.course_id = $1
         ORDER BY s.name ASC`,
        [course.id]
    );

    const universities = await pool.query(
        `SELECT u.id, u.name, u.slug, u.location, u.city_slug, u.image_url, u.rating, u.admission_open,
                o.fee_amount, o.fee_currency, o.fee_display, o.duration, o.eligibility,
                COALESCE(array_agg(DISTINCT s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '{}') AS streams
         FROM university_course_offerings o
         JOIN universities u ON u.id = o.university_id
         LEFT JOIN university_streams us ON us.university_id = u.id
         LEFT JOIN streams s ON s.id = us.stream_id
         WHERE o.course_id = $1
         GROUP BY u.id, o.id
         UNION
         SELECT u.id, u.name, u.slug, u.location, u.city_slug, u.image_url, u.rating, u.admission_open,
                NULL::numeric AS fee_amount, NULL::text AS fee_currency, NULL::text AS fee_display,
                NULL::text AS duration, NULL::text AS eligibility,
                COALESCE(array_agg(DISTINCT s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '{}') AS streams
         FROM universities u
         LEFT JOIN university_streams us ON us.university_id = u.id
         LEFT JOIN streams s ON s.id = us.stream_id
         WHERE u.courses_and_fees @> $2::jsonb
           AND NOT EXISTS (SELECT 1 FROM university_course_offerings o2
                           WHERE o2.university_id = u.id AND o2.course_id = $1)
         GROUP BY u.id
         ORDER BY rating DESC NULLS LAST, name ASC`,
        [course.id, JSON.stringify([{ course: course.name }])]
    );

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json({ course, streams: streams.rows, universities: universities.rows });
});

export const getCoursesByStreams = asyncHandler(async (req, res) => {
    const raw = typeof req.query.stream_ids === 'string' ? req.query.stream_ids : '';
    const ids = raw
        .split(',')
        .map((v) => Number.parseInt(v.trim(), 10))
        .filter((v) => Number.isInteger(v) && v > 0);

    if (ids.length === 0) return res.json([]);

    const result = await pool.query(
        `SELECT DISTINCT c.id, c.name, c.slug, c.description, c.icon_name
         FROM courses c
         JOIN stream_courses sc ON sc.course_id = c.id
         WHERE sc.stream_id = ANY($1::int[])
         ORDER BY c.name ASC, c.id ASC`,
        [ids]
    );
    return res.json(result.rows);
});
