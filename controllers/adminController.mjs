import pool from '../config/db.mjs';

export const getDashboardStats = async (req, res) => {
    try {
        const users = await pool.query('SELECT COUNT(*) FROM users');
        const applications = await pool.query('SELECT COUNT(*) FROM applications');
        const appointments = await pool.query('SELECT COUNT(*) FROM appointments');

        res.json({
            totalUsers: parseInt(users.rows[0].count),
            totalApplications: parseInt(applications.rows[0].count),
            totalAppointments: parseInt(appointments.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching dashboard data' });
    }
};