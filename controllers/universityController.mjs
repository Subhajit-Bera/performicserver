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


export const getTopUniversitiesByStream = async (req, res) => {
    try {
        // THE FIX: This query is now much more precise.
        // It specifically joins with `top_university_streams` to only get the
        // university/stream combinations that were explicitly marked as "Top".
        const result = await pool.query(`
            WITH RankedUniversities AS (
                SELECT 
                    u.id, u.name, u.slug, u.location, u.image_url, u.rating, u.admission_open, u.admission_year,
                    s.id as stream_id, 
                    s.name as stream_name, 
                    s.slug as stream_slug,
                    ROW_NUMBER() OVER(PARTITION BY s.id ORDER BY u.rating DESC, u.name) as rank
                FROM 
                    universities u
                -- This join ensures we only consider streams marked as "Top" for this university
                JOIN 
                    top_university_streams tus ON u.id = tus.university_id
                JOIN 
                    streams s ON tus.stream_id = s.id
                WHERE 
                    u.is_top_university = TRUE
            )
            SELECT * FROM RankedUniversities WHERE rank <= 3
        `);

        // Process the flat list into a grouped structure for the frontend
        const groupedByStream = result.rows.reduce((acc, uni) => {
            if (!acc[uni.stream_id]) {
                acc[uni.stream_id] = {
                    stream_id: uni.stream_id,
                    stream_name: uni.stream_name,
                    stream_slug: uni.stream_slug,
                    universities: []
                };
            }
            acc[uni.stream_id].universities.push(uni);
            return acc;
        }, {});

        res.json(Object.values(groupedByStream));
    } catch (err) {
        console.error("Error fetching top universities by stream:", err);
        res.status(500).json({ message: 'Error fetching top universities' });
    }
};

