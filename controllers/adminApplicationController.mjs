import pool from '../config/db.mjs';

export const getAllApplications = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT app.id, app.status, app.course_name, u.full_name, u.email, u.phone_number, u.state_hometown, uni.name as university_name
            FROM applications app
            JOIN users u ON app.user_id = u.id
            JOIN universities uni ON app.university_id = uni.id
            ORDER BY app.applied_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching applications' });
    }
};

export const updateApplication = async (req, res) => {
    const { id } = req.params;
    const { status, course_name } = req.body;
    if (status && !['Applied', 'Called', 'Converted'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status specified.' });
    }
    try {
        const result = await pool.query(
            'UPDATE applications SET status = COALESCE($1, status), course_name = COALESCE($2, course_name) WHERE id = $3 RETURNING *', 
            [status, course_name, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Application not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error updating application' });
    }
};