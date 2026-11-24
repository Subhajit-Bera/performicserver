import pool from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';

export const EXAM_COLUMNS = `
    id, name, slug, exam_date, exam_level, info, application_form, important_dates,
    syllabus, exam_pattern, admit_card_details, result_details, cutoff_details, created_at
`;

export const getAllExams = asyncHandler(async (_req, res) => {
    const result = await pool.query(
        `SELECT id, name, slug, info, exam_date, exam_level
         FROM exams
         ORDER BY name ASC, id ASC`
    );
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(result.rows);
});

export const getExamBySlug = asyncHandler(async (req, res) => {
    const slug = (req.params.slug ?? '').trim();
    if (!slug) throw ApiError.badRequest('Invalid exam slug');

    const result = await pool.query(`SELECT ${EXAM_COLUMNS} FROM exams WHERE slug = $1`, [slug]);
    if (result.rows.length === 0) throw ApiError.notFound('Exam not found');

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(result.rows[0]);
});
