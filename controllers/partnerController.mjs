import pool from '../config/db.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';

export const getAllPartners = asyncHandler(async (_req, res) => {
    const result = await pool.query(
        'SELECT id, name, location, featured_text, logo_url, link_stream_slug, link_city_slug FROM partners ORDER BY id ASC'
    );
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(result.rows);
});
