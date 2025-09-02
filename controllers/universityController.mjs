import pool from '../config/db.mjs';

export const getAllUniversities = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM universities ORDER BY rating DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching universities' });
    }
};

export const getUniversityById = async (req, res) => {
     try {
        const result = await pool.query('SELECT * FROM universities WHERE id = $1', [req.params.id]);
        if(result.rows.length === 0) return res.status(404).json({ message: 'University not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching university details' });
    }
};