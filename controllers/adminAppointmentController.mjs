import pool from '../config/db.mjs';

export const getAllAppointments = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id, a.appointment_date, a.status, u.full_name, u.email, u.phone_number, u.state_hometown, u.choice_of_stream, u.entry_level
            FROM appointments a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.appointment_date DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching appointments' });
    }
};

export const updateAppointmentStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Booked', 'Called', 'Converted'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status specified.' });
    }
    try {
        const result = await pool.query('UPDATE appointments SET status = $1 WHERE id = $2 RETURNING id, status', [status, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Appointment not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error updating appointment status' });
    }
};