// import pool from '../config/db.mjs';
// import { slugify } from '../utils/slugify.mjs';

// export const getAllStreams = async (req, res) => {
//     try {
//         const result = await pool.query('SELECT * FROM streams ORDER BY name');
//         res.json(result.rows);
//     } catch (err) { res.status(500).json({ message: "Error fetching streams" }); }
// };

// export const createStream = async (req, res) => {
//     const { name } = req.body;
//     const slug = slugify(name);
//     try {
//         const result = await pool.query('INSERT INTO streams (name, slug) VALUES ($1, $2) RETURNING *', [name, slug]);
//         res.status(201).json(result.rows[0]);
//     } catch (err) {
//         if (err.code === '23505') return res.status(409).json({ message: "A stream with this name already exists." });
//         res.status(500).json({ message: "Error creating stream" });
//     }
// };

// export const updateStream = async (req, res) => {
//     const { id } = req.params;
//     const { name } = req.body;
//     const slug = slugify(name);
//     try {
//         const result = await pool.query('UPDATE streams SET name=$1, slug=$2 WHERE id=$3 RETURNING *', [name, slug, id]);
//         if (result.rows.length === 0) return res.status(404).json({ message: "Stream not found" });
//         res.json(result.rows[0]);
//     } catch (err) {
//         if (err.code === '23505') return res.status(409).json({ message: "A stream with this name already exists." });
//         res.status(500).json({ message: "Error updating stream" });
//     }
// };

// export const deleteStream = async (req, res) => {
//     const { id } = req.params;
//     try {
//         await pool.query('DELETE FROM streams WHERE id=$1', [id]);
//         res.status(204).send();
//     } catch (err) { res.status(500).json({ message: "Error deleting stream" }); }
// };



import pool from '../config/db.mjs';
import { slugify } from '../utils/slugify.mjs';

// Get all streams and include the IDs of courses linked to them
// export const getAllStreams = async (req, res) => {
//     try {
//         const result = await pool.query(`
//             SELECT s.id, s.name, s.slug, COALESCE(json_agg(sc.course_id) FILTER (WHERE sc.course_id IS NOT NULL), '[]') as course_ids
//             FROM streams s
//             LEFT JOIN stream_courses sc ON s.id = sc.stream_id
//             GROUP BY s.id
//             ORDER BY s.name
//         `);
//         res.json(result.rows);
//     } catch (err) { res.status(500).json({ message: "Error fetching streams" }); }
// };



export const getAllStreams = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id, s.name, s.slug, COALESCE(json_agg(sc.course_id) FILTER (WHERE sc.course_id IS NOT NULL), '[]') as course_ids
            FROM streams s
            LEFT JOIN stream_courses sc ON s.id = sc.stream_id
            GROUP BY s.id
            ORDER BY s.name
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ message: "Error fetching streams" }); }
};





// export const createStream = async (req, res) => {
//     // ... code remains the same
// };
export const createStream = async (req, res) => {
    const { name } = req.body;
    const slug = slugify(name);
    try {
        const result = await pool.query('INSERT INTO streams (name, slug) VALUES ($1, $2) RETURNING *', [name, slug]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: "A stream with this name already exists." });
        res.status(500).json({ message: "Error creating stream" });
    }
};


// export const updateStream = async (req, res) => {
//     // ... code remains the same
// };
export const updateStream = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const slug = slugify(name);
    try {
        const result = await pool.query('UPDATE streams SET name=$1, slug=$2 WHERE id=$3 RETURNING *', [name, slug, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Stream not found" });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: "A stream with this name already exists." });
        res.status(500).json({ message: "Error updating stream" });
    }
};


// export const deleteStream = async (req, res) => {
//     // ... code remains the same
// };

export const deleteStream = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM streams WHERE id=$1', [id]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ message: "Error deleting stream" }); }
};

// NEW: Update the many-to-many relationship between a stream and courses
// export const updateStreamCourses = async (req, res) => {
//     const { id } = req.params;
//     const { course_ids = [] } = req.body;
//     const client = await pool.connect();
//     try {
//         await client.query('BEGIN');
//         // Delete old associations
//         await client.query('DELETE FROM stream_courses WHERE stream_id = $1', [id]);
//         // Insert new associations
//         if (course_ids.length > 0) {
//             const values = course_ids.map(courseId => `(${id}, ${courseId})`).join(',');
//             await client.query(`INSERT INTO stream_courses (stream_id, course_id) VALUES ${values}`);
//         }
//         await client.query('COMMIT');
//         res.status(200).json({ message: 'Stream courses updated successfully.' });
//     } catch (err) {
//         await client.query('ROLLBACK');
//         res.status(500).json({ message: "Error updating stream courses" });
//     } finally {
//         client.release();
//     }
// };


export const updateStreamCourses = async (req, res) => {
    const { id } = req.params;
    const { course_ids = [] } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM stream_courses WHERE stream_id = $1', [id]);
        if (course_ids.length > 0) {
            const values = course_ids.map(courseId => `(${id}, ${courseId})`).join(',');
            await client.query(`INSERT INTO stream_courses (stream_id, course_id) VALUES ${values}`);
        }
        await client.query('COMMIT');
        res.status(200).json({ message: 'Stream courses updated successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: "Error updating stream courses" });
    } finally {
        client.release();
    }
};




// NEW: Get all courses available for a given set of streams
// export const getCoursesByStreams = async (req, res) => {
//     const { stream_ids } = req.query;
//     if (!stream_ids) return res.json([]);
    
//     const ids = stream_ids.split(',').map(id => parseInt(id, 10));

//     try {
//         const result = await pool.query(`
//             SELECT DISTINCT c.*
//             FROM courses c
//             JOIN stream_courses sc ON c.id = sc.course_id
//             WHERE sc.stream_id = ANY($1::int[])
//             ORDER BY c.name
//         `, [ids]);
//         res.json(result.rows);
//     } catch (err) {
//         res.status(500).json({ message: "Error fetching courses by stream" });
//     }
// };


export const getCoursesByStreams = async (req, res) => {
    const { stream_ids } = req.query;
    if (!stream_ids) return res.json([]);
    
    const ids = stream_ids.split(',').map(id => parseInt(id, 10));
    if (ids.length === 0) return res.json([]);

    try {
        const result = await pool.query(`
            SELECT DISTINCT c.*
            FROM courses c
            JOIN stream_courses sc ON c.id = sc.course_id
            WHERE sc.stream_id = ANY($1::int[])
            ORDER BY c.name
        `, [ids]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching courses by stream" });
    }
};