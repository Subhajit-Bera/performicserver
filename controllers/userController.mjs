import pool from '../config/db.mjs';

export const getCurrentUser = async (req, res) => {
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if(userResult.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const { password_hash, refresh_token, ...user } = userResult.rows[0];
        res.json(user);
    } catch(err) {
        res.status(500).json({ message: 'Server error retrieving user profile' });
    }
};

export const updateUserProfile = async (req, res) => {
    const userId = req.user.id;
    const { phoneNumber, whatsAppNumber, stateHometown, choiceOfStream, choiceOfStreamOther, entryLevel, entryLevelOther, howHeard, howHeardOther } = req.body;
    try {
        const result = await pool.query(
            `UPDATE users SET 
                phone_number = $1, whatsapp_number = $2, state_hometown = $3, 
                choice_of_stream = $4, choice_of_stream_other = $5, 
                entry_level = $6, entry_level_other = $7, 
                how_heard = $8, how_heard_other = $9
            WHERE id = $10 RETURNING *`,
            [phoneNumber, whatsAppNumber, stateHometown, choiceOfStream, choiceOfStreamOther, entryLevel, entryLevelOther, howHeard, howHeardOther, userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const { password_hash, refresh_token, ...updatedUser } = result.rows[0];
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ message: 'Error updating user profile' });
    }
};

export const applyToUniversity = async (req, res) => {
    const { universityId } = req.body;
    const userId = req.user.id;
    if (!universityId) return res.status(400).json({ message: 'University ID is required' });
    try {
        const result = await pool.query('INSERT INTO applications (user_id, university_id) VALUES ($1, $2) RETURNING *', [userId, universityId]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if(err.code === '23505') return res.status(409).json({ message: 'You have already applied to this university.' });
        res.status(500).json({ message: 'Error submitting application' });
    }
};

export const bookAppointment = async(req, res) => {
    const { date, notes } = req.body;
    const userId = req.user.id;
    if(!date) return res.status(400).json({ message: 'Appointment date is required' });
    try {
        const result = await pool.query('INSERT INTO appointments (user_id, appointment_date, notes) VALUES ($1, $2, $3) RETURNING *', [userId, date, notes]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error booking appointment' });
    }
};