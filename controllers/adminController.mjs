import pool from '../config/db.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';

export const getDashboardStats = asyncHandler(async (_req, res) => {
    const [users, universities, exams, applications, appointments, agents, pendingApplications] =
        await Promise.all([
            pool.query('SELECT count(*)::int AS count FROM users'),
            pool.query('SELECT count(*)::int AS count FROM universities'),
            pool.query('SELECT count(*)::int AS count FROM exams'),
            pool.query('SELECT count(*)::int AS count FROM applications'),
            pool.query('SELECT count(*)::int AS count FROM appointments'),
            pool.query(`SELECT count(*)::int AS count FROM users WHERE role = 'agent'`),
            pool.query(`SELECT count(*)::int AS count FROM applications WHERE status = 'Applied'`),
        ]);

    return res.json({
        totalUsers: users.rows[0].count,
        totalUniversities: universities.rows[0].count,
        totalExams: exams.rows[0].count,
        totalApplications: applications.rows[0].count,
        totalAppointments: appointments.rows[0].count,
        totalAgents: agents.rows[0].count,
        pendingApplications: pendingApplications.rows[0].count,
    });
});
