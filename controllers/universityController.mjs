import pool from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { parsePagination } from '../utils/http.mjs';

const UNIVERSITY_COLUMNS = `
    u.id, u.name, u.slug, u.location, u.city_slug, u.rating, u.description, u.image_url,
    u.details, u.courses_and_fees, u.placements, u.facilities,
    u.admission_open, u.admission_year, u.is_top_university, u.created_at
`;

const STREAM_AGGREGATES = `
    COALESCE(array_agg(DISTINCT s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '{}') AS streams,
    COALESCE(array_agg(DISTINCT s.slug ORDER BY s.slug) FILTER (WHERE s.id IS NOT NULL), '{}') AS stream_slugs
`;

const DEFAULT_LIMIT = 100;

export const getAllUniversities = asyncHandler(async (req, res) => {
    const query = req.validatedQuery ?? req.query;
    const { page, limit, offset } = parsePagination({
        page: query.page,
        limit: Math.min(Number(query.limit ?? DEFAULT_LIMIT), DEFAULT_LIMIT),
    });

    const isTop = query.filter === 'top';
    const filters = [];
    const params = [];

    if (isTop) filters.push('u.is_top_university = TRUE');

    if (query.city) {
        params.push(query.city.toLowerCase());
        filters.push(`u.city_slug = $${params.length}`);
    }

    if (query.stream) {
        params.push(query.stream.toLowerCase());
        filters.push(
            `EXISTS (SELECT 1 FROM university_streams us2
                     JOIN streams s2 ON s2.id = us2.stream_id
                     WHERE us2.university_id = u.id AND s2.slug = $${params.length})`
        );
    }

    if (query.search) {
        params.push(`%${query.search}%`);
        filters.push(`(u.name ILIKE $${params.length} OR u.location ILIKE $${params.length})`);
    }

    if (query.admission_open === 'true') filters.push('u.admission_open = TRUE');

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    params.push(limit, offset);
    const result = await pool.query(
        `SELECT ${UNIVERSITY_COLUMNS}, ${STREAM_AGGREGATES}
         FROM universities u
         LEFT JOIN university_streams us ON us.university_id = u.id
         LEFT JOIN streams s ON s.id = us.stream_id
         ${where}
         GROUP BY u.id
         ORDER BY u.rating DESC NULLS LAST, u.name ASC, u.id ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(result.rows);
});

export const getUniversityBySlug = asyncHandler(async (req, res) => {
    const slug = (req.params.slug ?? '').trim();
    if (!slug) throw ApiError.badRequest('Invalid university slug');

    const result = await pool.query(
        `SELECT ${UNIVERSITY_COLUMNS}, ${STREAM_AGGREGATES},
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', o.id, 'course_id', o.course_id, 'course_name', c.name, 'course_slug', c.slug,
                            'fee_amount', o.fee_amount, 'fee_currency', o.fee_currency, 'fee_display', o.fee_display,
                            'duration', o.duration, 'eligibility', o.eligibility, 'admission_year', o.admission_year
                        ) ORDER BY c.name
                    ) FILTER (WHERE o.id IS NOT NULL), '[]'
                ) AS offerings
         FROM universities u
         LEFT JOIN university_streams us ON us.university_id = u.id
         LEFT JOIN streams s ON s.id = us.stream_id
         LEFT JOIN university_course_offerings o ON o.university_id = u.id
         LEFT JOIN courses c ON c.id = o.course_id
         WHERE u.slug = $1
         GROUP BY u.id`,
        [slug]
    );

    if (result.rows.length === 0) throw ApiError.notFound('University not found');

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(result.rows[0]);
});

export const getTopUniversitiesByStream = asyncHandler(async (_req, res) => {
    const result = await pool.query(`
        WITH ranked AS (
            SELECT u.id, u.name, u.slug, u.location, u.city_slug, u.image_url, u.rating,
                   u.admission_open, u.admission_year,
                   s.id AS stream_id, s.name AS stream_name, s.slug AS stream_slug,
                   ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY u.rating DESC NULLS LAST, u.name ASC, u.id ASC) AS rank
            FROM universities u
            JOIN top_university_streams tus ON tus.university_id = u.id
            JOIN streams s ON s.id = tus.stream_id
            WHERE u.is_top_university = TRUE
        )
        SELECT * FROM ranked WHERE rank <= 3 ORDER BY stream_name ASC, rank ASC
    `);

    const grouped = new Map();
    for (const row of result.rows) {
        if (!grouped.has(row.stream_id)) {
            grouped.set(row.stream_id, {
                stream_id: row.stream_id,
                stream_name: row.stream_name,
                stream_slug: row.stream_slug,
                universities: [],
            });
        }
        grouped.get(row.stream_id).universities.push(row);
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json([...grouped.values()]);
});
