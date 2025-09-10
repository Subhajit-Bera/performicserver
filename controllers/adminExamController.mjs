import pool from '../config/db.mjs';
import { slugify } from '../utils/slugify.mjs';

/**
 * @desc    Get all exams for the admin list view
 * @route   GET /api/admin/exams
 * @access  Private/Admin
 */
export const getAllExamsAdmin = async (req, res) => {
    try {
        // Selecting minimal data for the list view to be efficient
        const result = await pool.query('SELECT id, name, slug, exam_date, exam_level FROM exams ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching exams for admin:", err);
        res.status(500).json({ message: "Server error while fetching exams" });
    }
};

/**
 * @desc    Get a single exam by its ID for editing
 * @route   GET /api/admin/exams/:id
 * @access  Private/Admin
 */
export const getExamByIdAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM exams WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Exam not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error fetching exam with ID ${id}:`, err);
        res.status(500).json({ message: "Server error while fetching exam details" });
    }
};


/**
 * @desc    Create a new exam
 * @route   POST /api/admin/exams
 * @access  Private/Admin
 */
export const createExam = async (req, res) => {
    const {
        name,
        exam_date,
        exam_level,
        info,
        application_form,
        important_dates,
        syllabus,
        exam_pattern,
        admit_card_details,
        result_details,
        cutoff_details
    } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Exam name is required" });
    }

    const slug = slugify(name);

    try {
        const result = await pool.query(
            `INSERT INTO exams (
                name, slug, exam_date, exam_level, info, application_form, important_dates, 
                syllabus, exam_pattern, admit_card_details, result_details, cutoff_details
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                name, slug, exam_date, exam_level, info, application_form, important_dates,
                syllabus, exam_pattern, admit_card_details, result_details, cutoff_details
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Error creating exam:", err);
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ message: "An exam with this name already exists." });
        }
        res.status(500).json({ message: "Server error while creating exam" });
    }
};

/**
 * @desc    Update an existing exam
 * @route   PUT /api/admin/exams/:id
 * @access  Private/Admin
 */
export const updateExam = async (req, res) => {
    const { id } = req.params;
    const {
        name,
        exam_date,
        exam_level,
        info,
        application_form,
        important_dates,
        syllabus,
        exam_pattern,
        admit_card_details,
        result_details,
        cutoff_details
    } = req.body;
    
    if (!name) {
        return res.status(400).json({ message: "Exam name is required" });
    }

    const slug = slugify(name);

    try {
        const result = await pool.query(
            `UPDATE exams SET 
                name=$1, slug=$2, exam_date=$3, exam_level=$4, info=$5, application_form=$6, 
                important_dates=$7, syllabus=$8, exam_pattern=$9, admit_card_details=$10, 
                result_details=$11, cutoff_details=$12 
             WHERE id=$13 RETURNING *`,
            [
                name, slug, exam_date, exam_level, info, application_form, important_dates,
                syllabus, exam_pattern, admit_card_details, result_details, cutoff_details, id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Exam not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error updating exam with ID ${id}:`, err);
        if (err.code === '23505') {
            return res.status(409).json({ message: "An exam with this name already exists." });
        }
        res.status(500).json({ message: "Server error while updating exam" });
    }
};

/**
 * @desc    Delete an exam
 * @route   DELETE /api/admin/exams/:id
 * @access  Private/Admin
 */
export const deleteExam = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM exams WHERE id=$1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Exam not found" });
        }
        res.status(204).send(); // Success with No Content
    } catch (err) {
        console.error(`Error deleting exam with ID ${id}:`, err);
        res.status(500).json({ message: "Server error while deleting exam" });
    }
};