import pool from '../config/db.mjs';

// Search for a user by name + email/phone
export const searchUser = async (req, res) => {
    const { name, contact } = req.query; // contact can be email or phone
    if (!name || !contact) {
        return res.status(400).json({ message: 'Name and contact (email/phone) are required.' });
    }
    try {
        const result = await pool.query(
            'SELECT id, full_name, email, phone_number, referred_by FROM users WHERE full_name ILIKE $1 AND (email = $2 OR phone_number = $2)',
            [`%${name}%`, contact]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error searching for user' });
    }
};

// Refer a user
export const referUser = async (req, res) => {
    const { userId } = req.body;
    const agentId = req.user.id;
    try {
        const userCheck = await pool.query('SELECT referred_by FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) return res.status(404).json({ message: 'User not found.' });
        if (userCheck.rows[0].referred_by) return res.status(409).json({ message: 'This user has already been referred.' });

        const result = await pool.query(
            'UPDATE users SET referred_by = $1, referral_status = $2 WHERE id = $3 RETURNING id, full_name, referred_by',
            [agentId, 'Referred', userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error referring user' });
    }
};

// Get all users referred by the currently logged-in agent
export const getMyReferrals = async (req, res) => {
    const agentId = req.user.id;
    try {
        const result = await pool.query(
            'SELECT id, full_name, email, phone_number, whatsapp_number, choice_of_stream, referral_status FROM users WHERE referred_by = $1 ORDER BY created_at DESC',
            [agentId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching your referrals' });
    }
};