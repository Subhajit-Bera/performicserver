import pool from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { paginated, parsePagination, parseId } from '../utils/http.mjs';

export const getAllPartnersAdmin = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const rows = await pool.query(
        `SELECT id, name, location, featured_text, logo_url, link_stream_slug, link_city_slug, created_at, updated_at
         FROM partners
         ORDER BY name ASC, id ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    const total = await pool.query('SELECT count(*)::int AS total FROM partners');

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export const getPartnerByIdAdmin = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Partner id');
    const result = await pool.query('SELECT * FROM partners WHERE id = $1', [id]);
    if (result.rows.length === 0) throw ApiError.notFound('Partner not found');
    return res.json(result.rows[0]);
});

export const createPartner = asyncHandler(async (req, res) => {
    const data = req.validatedBody ?? req.body;
    const result = await pool.query(
        `INSERT INTO partners (name, location, featured_text, logo_url, link_stream_slug, link_city_slug)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
            data.name, data.location ?? null, data.featured_text ?? null,
            data.logo_url ?? null, data.link_stream_slug ?? null, data.link_city_slug ?? null,
        ]
    );
    return res.status(201).json(result.rows[0]);
});

export const updatePartner = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Partner id');
    const data = req.validatedBody ?? req.body;
    const result = await pool.query(
        `UPDATE partners SET name=$1, location=$2, featured_text=$3, logo_url=$4,
                link_stream_slug=$5, link_city_slug=$6, updated_at=now()
         WHERE id=$7 RETURNING *`,
        [
            data.name, data.location ?? null, data.featured_text ?? null,
            data.logo_url ?? null, data.link_stream_slug ?? null, data.link_city_slug ?? null, id,
        ]
    );
    if (result.rows.length === 0) throw ApiError.notFound('Partner not found');
    return res.json(result.rows[0]);
});

export const deletePartner = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Partner id');
    const result = await pool.query('DELETE FROM partners WHERE id = $1', [id]);
    if (result.rowCount === 0) throw ApiError.notFound('Partner not found');
    return res.status(204).send();
});
