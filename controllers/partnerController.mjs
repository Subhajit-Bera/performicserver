// import pool from '../config/db.mjs';

// export const getAllPartners = async (req, res) => {
//     try {
//         const result = await pool.query('SELECT * FROM partners ORDER BY id');
//         res.json(result.rows);
//     } catch (err) {
//         res.status(500).json({ message: 'Error fetching partners' });
//     }
// };



import pool from '../config/db.mjs';

export const getAllPartners = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM partners ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching partners:", err);
        res.status(500).json({ message: 'Error fetching partners' });
    }
};