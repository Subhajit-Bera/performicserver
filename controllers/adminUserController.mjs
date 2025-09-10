import pool from '../config/db.mjs';

// Get all users for the main user list
export const getAllUsers = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, full_name, email, role, phone_number, state_hometown FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// Update a user's role
export const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'agent', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }
    try {
        const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, role', [role, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error updating user role' });
    }
};

// Get all users with the 'agent' role
export const getAllAgents = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id, a.full_name, a.email, a.phone_number, COUNT(r.id) as referral_count
            FROM users a
            LEFT JOIN users r ON a.id = r.referred_by
            WHERE a.role = 'agent'
            GROUP BY a.id
            ORDER BY a.full_name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching agents' });
    }
};

// Get details for a single agent and the users they referred
export const getAgentDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const agentResult = await pool.query('SELECT id, full_name, email FROM users WHERE id = $1 AND role = \'agent\'', [id]);
        if (agentResult.rows.length === 0) return res.status(404).json({ message: 'Agent not found.' });

        const referralsResult = await pool.query('SELECT id, full_name, email, referral_status FROM users WHERE referred_by = $1', [id]);
        
        res.json({
            agent: agentResult.rows[0],
            referrals: referralsResult.rows
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching agent details' });
    }
};

// Update the status of a specific referral
export const updateReferralStatus = async (req, res) => {
    const { referralId } = req.params;
    const { status } = req.body;
    if (!['Referred', 'Converted'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }
    try {
        const result = await pool.query('UPDATE users SET referral_status = $1 WHERE id = $2 RETURNING id, referral_status', [status, referralId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Referred user not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error updating referral status' });
    }
};