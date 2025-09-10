// import pool from '../config/db.mjs';

// // Public controller for fetching university data
// export const getAllUniversities = async (req, res) => {
//     try {
//         const result = await pool.query(`
//             SELECT u.id, u.name, u.slug, u.location, u.image_url, u.rating, s.name as stream
//             FROM universities u
//             LEFT JOIN streams s ON u.stream_id = s.id
//             ORDER BY u.rating DESC
//         `);
//         res.json(result.rows);
//     } catch (err) {
//         res.status(500).json({ message: 'Error fetching universities' });
//     }
// };

// export const getUniversityBySlug = async (req, res) => {
//      try {
//         const result = await pool.query('SELECT * FROM universities WHERE slug = $1', [req.params.slug]);
//         if(result.rows.length === 0) return res.status(404).json({ message: 'University not found' });
//         res.json(result.rows[0]);
//     } catch (err) {
//         res.status(500).json({ message: 'Error fetching university details' });
//     }
// };


import pool from '../config/db.mjs';

// Public controller for fetching university data
// export const getAllUniversities = async (req, res) => {
//     try {
//         const result = await pool.query(`
//             SELECT u.*, array_agg(s.name) as streams
//             FROM universities u
//             LEFT JOIN university_streams us ON u.id = us.university_id
//             LEFT JOIN streams s ON us.stream_id = s.id
//             GROUP BY u.id
//             ORDER BY u.rating DESC
//         `);
//         res.json(result.rows);
//     } catch (err) {
//         res.status(500).json({ message: 'Error fetching universities' });
//     }
// };

export const getAllUniversities = async (req, res) => {
    const { filter } = req.query;

    try {
        let result;
        if (filter === 'top') {
            // This query is a bit complex: it finds the highest rated university within each stream
            // and returns a distinct list of those universities.
            result = await pool.query(`
                WITH RankedUniversities AS (
                    SELECT u.*, s.name as stream_name, ROW_NUMBER() OVER(PARTITION BY s.id ORDER BY u.rating DESC) as rn
                    FROM universities u
                    JOIN university_streams us ON u.id = us.university_id
                    JOIN streams s ON us.stream_id = s.id
                    WHERE u.is_top_university = TRUE AND us.stream_id IN (SELECT stream_id FROM top_university_streams WHERE university_id = u.id)
                )
                SELECT * FROM RankedUniversities WHERE rn = 1
            `);
        } else {
            result = await pool.query(`
                SELECT u.*, array_agg(s.name) as streams
                FROM universities u
                LEFT JOIN university_streams us ON u.id = us.university_id
                LEFT JOIN streams s ON us.stream_id = s.id
                GROUP BY u.id
                ORDER BY u.rating DESC
            `);
        }
        res.json(result.rows);
    } catch (err) {
        console.error("Error in getAllUniversities:", err);
        res.status(500).json({ message: 'Error fetching universities' });
    }
};

export const getUniversityBySlug = async (req, res) => {
     try {
        const result = await pool.query(`
            SELECT u.*, array_agg(s.name) as streams
            FROM universities u
            LEFT JOIN university_streams us ON u.id = us.university_id
            LEFT JOIN streams s ON us.stream_id = s.id
            WHERE u.slug = $1
            GROUP BY u.id
        `, [req.params.slug]);

        if(result.rows.length === 0) return res.status(404).json({ message: 'University not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching university details' });
    }
};