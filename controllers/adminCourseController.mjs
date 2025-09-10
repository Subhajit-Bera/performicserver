// import pool from '../config/db.mjs';
// import { slugify } from '../utils/slugify.mjs';

// export const getAllCoursesAdmin = async (req, res) => {
//     try {
//         const result = await pool.query('SELECT * FROM courses ORDER BY name');
//         res.json(result.rows);
//     } catch (err) { res.status(500).json({ message: "Error fetching courses" }); }
// };

// export const createCourse = async (req, res) => {
//     const { name, description, icon_name, related_university_ids } = req.body;
//     const slug = slugify(name);
//     try {
//         const result = await pool.query(
//             'INSERT INTO courses (name, slug, description, icon_name, related_university_ids) VALUES ($1, $2, $3, $4, $5) RETURNING *',
//             [name, slug, description, icon_name, related_university_ids]
//         );
//         res.status(201).json(result.rows[0]);
//     } catch (err) {
//         if (err.code === '23505') return res.status(409).json({ message: "A course with this name already exists." });
//         res.status(500).json({ message: "Error creating course" });
//     }
// };

// export const updateCourse = async (req, res) => {
//     const { id } = req.params;
//     const { name, description, icon_name, related_university_ids } = req.body;
//     const slug = slugify(name);
//     try {
//         const result = await pool.query(
//             'UPDATE courses SET name=$1, slug=$2, description=$3, icon_name=$4, related_university_ids=$5 WHERE id=$6 RETURNING *',
//             [name, slug, description, icon_name, related_university_ids, id]
//         );
//         res.json(result.rows[0]);
//     } catch (err) {
//         if (err.code === '23505') return res.status(409).json({ message: "A course with this name already exists." });
//         res.status(500).json({ message: "Error updating course" });
//     }
// };

// export const deleteCourse = async (req, res) => {
//     const { id } = req.params;
//     try {
//         await pool.query('DELETE FROM courses WHERE id=$1', [id]);
//         res.status(204).send();
//     } catch (err) { res.status(500).json({ message: "Error deleting course" }); }
// };


import pool from '../config/db.mjs';
import { slugify } from '../utils/slugify.mjs';

export const getAllCoursesAdmin = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM courses ORDER BY name');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ message: "Error fetching courses" }); }
};

export const createCourse = async (req, res) => {
    const { name, description, icon_name } = req.body;
    const slug = slugify(name);
    try {
        const result = await pool.query(
            'INSERT INTO courses (name, slug, description, icon_name) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, slug, description, icon_name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: "A course with this name already exists." });
        res.status(500).json({ message: "Error creating course" });
    }
};

export const updateCourse = async (req, res) => {
    const { id } = req.params;
    const { name, description, icon_name } = req.body;
    const slug = slugify(name);
    try {
        const result = await pool.query(
            'UPDATE courses SET name=$1, slug=$2, description=$3, icon_name=$4 WHERE id=$5 RETURNING *',
            [name, slug, description, icon_name, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: "A course with this name already exists." });
        res.status(500).json({ message: "Error updating course" });
    }
};

export const deleteCourse = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM courses WHERE id=$1', [id]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ message: "Error deleting course" }); }
};