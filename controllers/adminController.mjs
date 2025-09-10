import pool from '../config/db.mjs';

export const getDashboardStats = async (req, res) => {
    try {
        const users = await pool.query('SELECT COUNT(*) FROM users');
        const universities = await pool.query('SELECT COUNT(*) FROM universities');
        const exams = await pool.query('SELECT COUNT(*) FROM exams');
        const applications = await pool.query('SELECT COUNT(*) FROM applications');
        
        res.json({
            totalUsers: parseInt(users.rows[0].count),
            totalUniversities: parseInt(universities.rows[0].count),
            totalExams: parseInt(exams.rows[0].count),
            totalApplications: parseInt(applications.rows[0].count),
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching dashboard data' });
    }
};