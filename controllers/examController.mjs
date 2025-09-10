import pool from '../config/db.mjs';

// Public controller for fetching exam data
export const getAllExams = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, slug,info, exam_date, exam_level FROM exams ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching exams' });
    }
};

export const getExamBySlug = async (req, res) => {
     try {
        const result = await pool.query('SELECT * FROM exams WHERE slug = $1', [req.params.slug]);
        if(result.rows.length === 0) return res.status(404).json({ message: 'Exam not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching exam details' });
    }
};