import pool from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { paginated, parsePagination, parseId } from '../utils/http.mjs';
import { slugify } from '../utils/slugify.mjs';

const EXAM_FIELDS = [
    'exam_date', 'exam_level', 'info', 'application_form', 'important_dates',
    'syllabus', 'exam_pattern', 'admit_card_details', 'result_details', 'cutoff_details',
];

const jsonb = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

const buildParams = (data, slug) => [
    data.name, slug,
    data.exam_date ?? null, data.exam_level ?? null, data.info ?? null,
    jsonb(data.application_form), jsonb(data.important_dates), jsonb(data.syllabus),
    jsonb(data.exam_pattern), jsonb(data.admit_card_details), jsonb(data.result_details),
    jsonb(data.cutoff_details),
];

export const getAllExamsAdmin = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);

    const filters = [];
    const params = [];
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
        params.push(`%${search}%`);
        filters.push(`name ILIKE $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    params.push(limit, offset);
    const rows = await pool.query(
        `SELECT id, name, slug, exam_date, exam_level, created_at, updated_at
         FROM exams ${where}
         ORDER BY name ASC, id ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    const total = await pool.query(`SELECT count(*)::int AS total FROM exams ${where}`, params.slice(0, -2));

    return res.json(paginated(rows.rows, { page, limit }, total.rows[0].total));
});

export const getExamByIdAdmin = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Exam id');
    const result = await pool.query('SELECT * FROM exams WHERE id = $1', [id]);
    if (result.rows.length === 0) throw ApiError.notFound('Exam not found');
    return res.json(result.rows[0]);
});

export const createExam = asyncHandler(async (req, res) => {
    const data = req.validatedBody ?? req.body;
    const slug = slugify(data.name);
    if (!slug) throw ApiError.badRequest('Exam name must contain at least one alphanumeric character');

    const result = await pool.query(
        `INSERT INTO exams (name, slug, ${EXAM_FIELDS.join(', ')})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        buildParams(data, slug)
    );

    return res.status(201).json(result.rows[0]);
});

export const updateExam = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Exam id');
    const data = req.validatedBody ?? req.body;
    const slug = slugify(data.name);
    if (!slug) throw ApiError.badRequest('Exam name must contain at least one alphanumeric character');

    const result = await pool.query(
        `UPDATE exams SET
            name=$1, slug=$2, exam_date=$3, exam_level=$4, info=$5, application_form=$6,
            important_dates=$7, syllabus=$8, exam_pattern=$9, admit_card_details=$10,
            result_details=$11, cutoff_details=$12, updated_at=now()
         WHERE id=$13 RETURNING *`,
        [...buildParams(data, slug), id]
    );

    if (result.rows.length === 0) throw ApiError.notFound('Exam not found');
    return res.json(result.rows[0]);
});

export const deleteExam = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Exam id');
    const result = await pool.query('DELETE FROM exams WHERE id = $1', [id]);
    if (result.rowCount === 0) throw ApiError.notFound('Exam not found');
    return res.status(204).send();
});
