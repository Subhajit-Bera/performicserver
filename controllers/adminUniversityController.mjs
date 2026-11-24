import pool, { withTransaction } from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { paginated, parsePagination, parseId, parseIdList } from '../utils/http.mjs';
import { slugify } from '../utils/slugify.mjs';

const jsonb = (value, fallback) => JSON.stringify(value ?? fallback);

const assertTopStreamSubset = (streamIds = [], topStreamIds = []) => {
    if (topStreamIds.length === 0) return;
    const allowed = new Set(streamIds);
    const invalid = topStreamIds.filter((id) => !allowed.has(id));
    if (invalid.length > 0) {
        throw ApiError.unprocessable(
            'Top streams must also be selected as university streams',
            { invalidStreamIds: invalid }
        );
    }
};

const replaceStreamLinks = async (client, universityId, streamIds = []) => {
    await client.query('DELETE FROM university_streams WHERE university_id = $1', [universityId]);
    await client.query('DELETE FROM top_university_streams WHERE university_id = $1', [universityId]);
    const unique = [...new Set(streamIds)];
    if (unique.length > 0) {
        await client.query(
            'INSERT INTO university_streams (university_id, stream_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING',
            [universityId, unique]
        );
    }
};

const replaceTopStreamLinks = async (client, universityId, topStreamIds = []) => {
    const unique = [...new Set(topStreamIds)];
    if (unique.length === 0) return;
    await client.query(
        `INSERT INTO top_university_streams (university_id, stream_id)
         SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
        [universityId, unique]
    );
};

const replaceOfferings = async (client, universityId, offerings) => {
    await client.query('DELETE FROM university_course_offerings WHERE university_id = $1', [universityId]);
    if (!offerings || offerings.length === 0) return;

    for (const offering of offerings) {
        await client.query(
            `INSERT INTO university_course_offerings
                (university_id, course_id, fee_amount, fee_currency, fee_display, duration, eligibility, admission_year)
             VALUES ($1, $2, $3, COALESCE($4, 'INR'), $5, $6, $7, $8)
             ON CONFLICT (university_id, course_id) DO UPDATE SET
                fee_amount = EXCLUDED.fee_amount,
                fee_currency = EXCLUDED.fee_currency,
                fee_display = EXCLUDED.fee_display,
                duration = EXCLUDED.duration,
                eligibility = EXCLUDED.eligibility,
                admission_year = EXCLUDED.admission_year`,
            [
                universityId,
                offering.course_id,
                offering.fee_amount ?? null,
                offering.fee_currency ?? null,
                offering.fee_display ?? null,
                offering.duration ?? null,
                offering.eligibility ?? null,
                offering.admission_year ?? null,
            ]
        );
    }
};

export const getAllUniversitiesAdmin = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const filters = [];
    const params = [];
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
        params.push(`%${search}%`);
        filters.push(`(u.name ILIKE $${params.length} OR u.location ILIKE $${params.length})`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    params.push(limit, offset);
    const rows = await pool.query(
        `SELECT u.id, u.name, u.slug, u.location, u.city_slug, u.rating,
                u.admission_open, u.admission_year, u.is_top_university, u.updated_at,
                COALESCE(STRING_AGG(s.name, ', ' ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '') AS stream_name
         FROM universities u
         LEFT JOIN university_streams us ON us.university_id = u.id
         LEFT JOIN streams s ON s.id = us.stream_id
         ${where}
         GROUP BY u.id
         ORDER BY u.name ASC, u.id ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    const total = await pool.query(`SELECT count(*)::int AS total FROM universities u ${where}`, params.slice(0, -2));

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export const getUniversityByIdAdmin = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'University id');

    const universityResult = await pool.query('SELECT * FROM universities WHERE id = $1', [id]);
    if (universityResult.rows.length === 0) throw ApiError.notFound('University not found');
    const university = universityResult.rows[0];

    const [streams, topStreams, offerings] = await Promise.all([
        pool.query('SELECT stream_id FROM university_streams WHERE university_id = $1 ORDER BY stream_id', [id]),
        pool.query('SELECT stream_id FROM top_university_streams WHERE university_id = $1 ORDER BY stream_id', [id]),
        pool.query(
            `SELECT o.id, o.course_id, o.fee_amount, o.fee_currency, o.fee_display, o.duration, o.eligibility, o.admission_year, c.name AS course_name
             FROM university_course_offerings o
             JOIN courses c ON c.id = o.course_id
             WHERE o.university_id = $1
             ORDER BY c.name ASC`,
            [id]
        ),
    ]);

    university.stream_ids = streams.rows.map((r) => r.stream_id);
    university.top_stream_ids = topStreams.rows.map((r) => r.stream_id);
    university.offerings = offerings.rows;

    return res.json(university);
});

export const createUniversity = asyncHandler(async (req, res) => {
    const data = req.validatedBody ?? req.body;
    const streamIds = parseIdList(data.stream_ids);
    const topStreamIds = data.is_top_university ? parseIdList(data.top_stream_ids) : [];
    assertTopStreamSubset(streamIds, topStreamIds);

    const slug = slugify(data.name);
    if (!slug) throw ApiError.badRequest('University name must contain at least one alphanumeric character');

    const university = await withTransaction(async (client) => {
        const result = await client.query(
            `INSERT INTO universities
                (name, slug, location, rating, description, image_url, details, courses_and_fees,
                 placements, facilities, admission_open, admission_year, is_top_university)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [
                data.name, slug, data.location, data.rating ?? null, data.description ?? null,
                data.image_url ?? null, jsonb(data.details, {}), jsonb(data.courses_and_fees, []),
                jsonb(data.placements, {}), data.facilities ?? [], Boolean(data.admission_open),
                data.admission_year ?? null, Boolean(data.is_top_university),
            ]
        );
        const created = result.rows[0];

        await replaceStreamLinks(client, created.id, streamIds);
        await replaceTopStreamLinks(client, created.id, topStreamIds);
        await replaceOfferings(client, created.id, data.offerings);

        return created;
    });

    return res.status(201).json(university);
});

export const updateUniversity = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'University id');
    const data = req.validatedBody ?? req.body;
    const streamIds = parseIdList(data.stream_ids);
    const topStreamIds = data.is_top_university ? parseIdList(data.top_stream_ids) : [];
    assertTopStreamSubset(streamIds, topStreamIds);

    const slug = slugify(data.name);
    if (!slug) throw ApiError.badRequest('University name must contain at least one alphanumeric character');

    const university = await withTransaction(async (client) => {
        const result = await client.query(
            `UPDATE universities SET
                name=$1, slug=$2, location=$3, rating=$4, description=$5, image_url=$6,
                details=$7, courses_and_fees=$8, placements=$9, facilities=$10,
                admission_open=$11, admission_year=$12, is_top_university=$13, updated_at=now()
             WHERE id=$14
             RETURNING *`,
            [
                data.name, slug, data.location, data.rating ?? null, data.description ?? null,
                data.image_url ?? null, jsonb(data.details, {}), jsonb(data.courses_and_fees, []),
                jsonb(data.placements, {}), data.facilities ?? [], Boolean(data.admission_open),
                data.admission_year ?? null, Boolean(data.is_top_university), id,
            ]
        );
        if (result.rows.length === 0) throw ApiError.notFound('University not found');
        const updated = result.rows[0];

        await replaceStreamLinks(client, id, streamIds);
        await replaceTopStreamLinks(client, id, topStreamIds);
        if (data.offerings !== undefined) await replaceOfferings(client, id, data.offerings);

        return updated;
    });

    return res.json(university);
});

export const deleteUniversity = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'University id');

    const [applications] = await Promise.all([
        pool.query('SELECT count(*)::int AS count FROM applications WHERE university_id = $1', [id]),
    ]);
    if (applications.rows[0].count > 0) {
        throw ApiError.conflict(
            `Cannot delete this university: ${applications.rows[0].count} application(s) reference it. Close admissions instead.`
        );
    }

    const result = await pool.query('DELETE FROM universities WHERE id = $1', [id]);
    if (result.rowCount === 0) throw ApiError.notFound('University not found');

    return res.status(204).send();
});
