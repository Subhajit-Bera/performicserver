// import pool from '../config/db.mjs';
// import { slugify } from '../utils/slugify.mjs';

// export const getAllUniversitiesAdmin = async (req, res) => {
//     try {
//         const result = await pool.query('SELECT u.id, u.name, u.slug, u.location, s.name as stream_name FROM universities u LEFT JOIN streams s ON u.stream_id = s.id ORDER BY u.name');
//         res.json(result.rows);
//     } catch (err) {
//         res.status(500).json({ message: "Error fetching universities" });
//     }
// };

// export const createUniversity = async (req, res) => {
//     const { name, location, stream_id, rating, description, image_url, details, courses_and_fees, placements, facilities } = req.body;
//     const slug = slugify(name);
//     try {
//         const result = await pool.query(
//             `INSERT INTO universities (name, slug, location, stream_id, rating, description, image_url, details, courses_and_fees, placements, facilities)
//              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
//             [name, slug, location, stream_id, rating, description, image_url, details, courses_and_fees, placements, facilities]
//         );
//         res.status(201).json(result.rows[0]);
//     } catch (err) {
//         if (err.code === '23505') return res.status(409).json({ message: "A university with this name or slug already exists." });
//         res.status(500).json({ message: "Error creating university" });
//     }
// };

// export const updateUniversity = async (req, res) => {
//     const { id } = req.params;
//     const { name, location, stream_id, rating, description, image_url, details, courses_and_fees, placements, facilities } = req.body;
//     const slug = slugify(name);
//     try {
//         const result = await pool.query(
//             `UPDATE universities SET name=$1, slug=$2, location=$3, stream_id=$4, rating=$5, description=$6, image_url=$7, details=$8, courses_and_fees=$9, placements=$10, facilities=$11
//              WHERE id=$12 RETURNING *`,
//             [name, slug, location, stream_id, rating, description, image_url, details, courses_and_fees, placements, facilities, id]
//         );
//         if(result.rows.length === 0) return res.status(404).json({ message: "University not found" });
//         res.json(result.rows[0]);
//     } catch (err) {
//         if (err.code === '23505') return res.status(409).json({ message: "A university with this name or slug already exists." });
//         res.status(500).json({ message: "Error updating university" });
//     }
// };

// export const deleteUniversity = async (req, res) => {
//     const { id } = req.params;
//     try {
//         const result = await pool.query('DELETE FROM universities WHERE id=$1', [id]);
//         if (result.rowCount === 0) return res.status(404).json({ message: "University not found" });
//         res.status(204).send();
//     } catch (err) {
//         res.status(500).json({ message: "Error deleting university" });
//     }
// };



import pool from '../config/db.mjs';
import { slugify } from '../utils/slugify.mjs';

// Get all universities for admin list view
// export const getAllUniversitiesAdmin = async (req, res) => {
//     try {
//         const result = await pool.query('SELECT u.id, u.name, u.slug, u.location, s.name as stream_name FROM universities u LEFT JOIN streams s ON u.stream_id = s.id ORDER BY u.name');
//         res.json(result.rows);
//     } catch (err) {
//         console.error("Error fetching universities for admin:", err);
//         res.status(500).json({ message: "Error fetching universities" });
//     }
// };

// Create a new university (UPDATED LOGIC)
// export const createUniversity = async (req, res) => {
//     const {
//         name, location, stream_id, rating, description, image_url,
//         details = {},
//         courses_and_fees = [],
//         placements = {},
//         facilities = []
//     } = req.body;

//     const slug = slugify(name);

//     try {
//         const result = await pool.query(
//             `INSERT INTO universities (name, slug, location, stream_id, rating, description, image_url, details, courses_and_fees, placements, facilities)
//              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
//             [
//                 name, slug, location, stream_id, rating, description, image_url,
//                 // THE FIX: Manually stringify all JSONB fields
//                 JSON.stringify(details),
//                 JSON.stringify(courses_and_fees),
//                 JSON.stringify(placements),
//                 facilities // TEXT[] arrays are handled correctly by the driver
//             ]
//         );
//         res.status(201).json(result.rows[0]);
//     } catch (err) {
//         console.error("Error creating university in database:", err);
//         if (err.code === '23505') {
//             return res.status(409).json({ message: "A university with this name already exists." });
//         }
//         res.status(500).json({ message: "Error creating university", error: err.message });
//     }
// };



export const getAllUniversitiesAdmin = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, 
                u.name, 
                u.slug, 
                u.location, 
                -- Aggregate all stream names associated with the university into a single string
                STRING_AGG(s.name, ', ') as stream_name 
            FROM 
                universities u 
            LEFT JOIN 
                university_streams us ON u.id = us.university_id 
            LEFT JOIN 
                streams s ON us.stream_id = s.id 
            GROUP BY 
                u.id 
            ORDER BY 
                u.name
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching universities for admin:", err);
        res.status(500).json({ message: "Error fetching universities" });
    }
};

// Get a single university by ID for the admin edit form
// export const getUniversityByIdAdmin = async (req, res) => {
//     const { id } = req.params;
//     try {
//         // First, get the main university data
//         const universityResult = await pool.query('SELECT * FROM universities WHERE id = $1', [id]);
//         if (universityResult.rows.length === 0) {
//             return res.status(404).json({ message: "University not found" });
//         }
//         const university = universityResult.rows[0];

//         // Next, get the associated stream IDs
//         const streamsResult = await pool.query('SELECT stream_id FROM university_streams WHERE university_id = $1', [id]);
//         university.stream_ids = streamsResult.rows.map(row => row.stream_id);

//         res.json(university);
//     } catch (err) {
//         console.error(`Error fetching university with ID ${id}:`, err);
//         res.status(500).json({ message: "Server error while fetching university details" });
//     }
// };

export const getUniversityByIdAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const universityResult = await pool.query('SELECT * FROM universities WHERE id = $1', [id]);
        if (universityResult.rows.length === 0) return res.status(404).json({ message: "University not found" });

        const university = universityResult.rows[0];

        const streamsResult = await pool.query('SELECT stream_id FROM university_streams WHERE university_id = $1', [id]);
        university.stream_ids = streamsResult.rows.map(row => row.stream_id);

        const topStreamsResult = await pool.query('SELECT stream_id FROM top_university_streams WHERE university_id = $1', [id]);
        university.top_stream_ids = topStreamsResult.rows.map(row => row.stream_id);

        res.json(university);
    } catch (err) {
        res.status(500).json({ message: "Server error while fetching university details" });
    }
};







// export const createUniversity = async (req, res) => {
//     const { stream_ids = [], admission_open = false, admission_year, ...uniData } = req.body;
//     const slug = slugify(uniData.name);
//     const client = await pool.connect();

//     try {
//         await client.query('BEGIN');

//         const uniResult = await client.query(
//             `INSERT INTO universities (name, slug, location, rating, description, image_url, details, courses_and_fees, placements, facilities, admission_open, admission_year)
//              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
//             [uniData.name, slug, uniData.location, uniData.rating, uniData.description, uniData.image_url, JSON.stringify(uniData.details), JSON.stringify(uniData.courses_and_fees), JSON.stringify(uniData.placements), uniData.facilities, admission_open, admission_year]
//         );
//         const universityId = uniResult.rows[0].id;

//         if (stream_ids && stream_ids.length > 0) {
//             const streamValues = stream_ids.map(streamId => `(${universityId}, ${streamId})`).join(',');
//             await client.query(`INSERT INTO university_streams (university_id, stream_id) VALUES ${streamValues}`);
//         }

//         await client.query('COMMIT');
//         res.status(201).json({ id: universityId });
//     } catch (err) {
//         await client.query('ROLLBACK');
//         console.error("Error creating university in database:", err);
//         if (err.code === '23505') return res.status(409).json({ message: "A university with this name already exists." });
//         res.status(500).json({ message: "Error creating university" });
//     } finally {
//         client.release();
//     }
// };



export const createUniversity = async (req, res) => {
    const { stream_ids = [], is_top_university = false, top_stream_ids = [], ...uniData } = req.body;
    const slug = slugify(uniData.name);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const uniResult = await client.query(
            `INSERT INTO universities (name, slug, location, rating, description, image_url, details, courses_and_fees, placements, facilities, admission_open, admission_year, is_top_university)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [uniData.name, slug, uniData.location, uniData.rating, uniData.description, uniData.image_url, JSON.stringify(uniData.details), JSON.stringify(uniData.courses_and_fees), JSON.stringify(uniData.placements), uniData.facilities, uniData.admission_open, uniData.admission_year, is_top_university]
        );
        const universityId = uniResult.rows[0].id;

        if (stream_ids && stream_ids.length > 0) { /* ... handle regular streams ... */ }
        if (is_top_university && top_stream_ids && top_stream_ids.length > 0) {
            const topStreamValues = top_stream_ids.map(streamId => `(${universityId}, ${streamId})`).join(',');
            await client.query(`INSERT INTO top_university_streams (university_id, stream_id) VALUES ${topStreamValues}`);
        }
        await client.query('COMMIT');
        res.status(201).json({ id: universityId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error creating university in database:", err);
        if (err.code === '23505') return res.status(409).json({ message: "A university with this name already exists." });
        res.status(500).json({ message: "Error creating university" });
    } finally {
        client.release();
    }
};




// export const getUniversityByIdAdmin = async (req, res) => {
//     const { id } = req.params;
//     try {
//         const result = await pool.query('SELECT * FROM universities WHERE id = $1', [id]);
//         if (result.rows.length === 0) {
//             return res.status(404).json({ message: "University not found" });
//         }
//         res.json(result.rows[0]);
//     } catch (err) {
//         console.error(`Error fetching university with ID ${id}:`, err);
//         res.status(500).json({ message: "Server error while fetching university details" });
//     }
// };


// Update an existing university (UPDATED LOGIC)
// export const updateUniversity = async (req, res) => {
//     const { id } = req.params;
//     const {
//         name, location, stream_id, rating, description, image_url,
//         details = {},
//         courses_and_fees = [],
//         placements = {},
//         facilities = []
//     } = req.body;

//     const slug = slugify(name);

//     try {
//         const result = await pool.query(
//             `UPDATE universities SET name=$1, slug=$2, location=$3, stream_id=$4, rating=$5, description=$6, image_url=$7, details=$8, courses_and_fees=$9, placements=$10, facilities=$11
//              WHERE id=$12 RETURNING *`,
//             [
//                 name, slug, location, stream_id, rating, description, image_url,
//                 // THE FIX: Manually stringify all JSONB fields
//                 JSON.stringify(details),
//                 JSON.stringify(courses_and_fees),
//                 JSON.stringify(placements),
//                 facilities,
//                 id
//             ]
//         );
//         if(result.rows.length === 0) return res.status(404).json({ message: "University not found" });
//         res.json(result.rows[0]);
//     } catch (err) {
//         console.error(`Error updating university with ID ${id}:`, err);
//         if (err.code === '23505') {
//             return res.status(409).json({ message: "A university with this name already exists." });
//         }
//         res.status(500).json({ message: "Error updating university", error: err.message });
//     }
// };

// export const updateUniversity = async (req, res) => {
//     const { id } = req.params;
//     const { stream_ids = [], admission_open = false, admission_year, ...uniData } = req.body;
//     const slug = slugify(uniData.name);
//     const client = await pool.connect();

//     try {
//         await client.query('BEGIN');

//         const result = await client.query(
//             `UPDATE universities SET name=$1, slug=$2, location=$3, rating=$4, description=$5, image_url=$6, details=$7, courses_and_fees=$8, placements=$9, facilities=$10, admission_open=$11, admission_year=$12
//              WHERE id=$13 RETURNING *`,
//             [uniData.name, slug, uniData.location, uniData.rating, uniData.description, uniData.image_url, JSON.stringify(uniData.details), JSON.stringify(uniData.courses_and_fees), JSON.stringify(uniData.placements), uniData.facilities, admission_open, admission_year, id]
//         );
//         if (result.rows.length === 0) {
//             await client.query('ROLLBACK');
//             return res.status(404).json({ message: "University not found" });
//         }

//         await client.query('DELETE FROM university_streams WHERE university_id = $1', [id]);
//         if (stream_ids && stream_ids.length > 0) {
//             const streamValues = stream_ids.map(streamId => `(${id}, ${streamId})`).join(',');
//             await client.query(`INSERT INTO university_streams (university_id, stream_id) VALUES ${streamValues}`);
//         }

//         await client.query('COMMIT');
//         res.json(result.rows[0]);
//     } catch (err) {
//         await client.query('ROLLBACK');
//         console.error(`Error updating university with ID ${id}:`, err);
//         if (err.code === '23505') return res.status(409).json({ message: "A university with this name already exists." });
//         res.status(500).json({ message: "Error updating university" });
//     } finally {
//         client.release();
//     }
// };

export const updateUniversity = async (req, res) => {
    const { id } = req.params;
    const { stream_ids = [], is_top_university = false, top_stream_ids = [], ...uniData } = req.body;
    const slug = slugify(uniData.name);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE universities SET name=$1, slug=$2, location=$3, rating=$4, description=$5, image_url=$6, details=$7, courses_and_fees=$8, placements=$9, facilities=$10, admission_open=$11, admission_year=$12, is_top_university=$13
             WHERE id=$14 RETURNING *`,
            [uniData.name, slug, uniData.location, uniData.rating, uniData.description, uniData.image_url, JSON.stringify(uniData.details), JSON.stringify(uniData.courses_and_fees), JSON.stringify(uniData.placements), uniData.facilities, uniData.admission_open, uniData.admission_year, is_top_university, id]
        );
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "University not found" });
        }

        // THE FIX: Correctly handle stream updates within a transaction
        await client.query('DELETE FROM university_streams WHERE university_id = $1', [id]);
        if (stream_ids && stream_ids.length > 0) {
            const streamValues = stream_ids.map(streamId => `(${id}, ${streamId})`).join(',');
            await client.query(`INSERT INTO university_streams (university_id, stream_id) VALUES ${streamValues}`);
        }

        await client.query('DELETE FROM top_university_streams WHERE university_id = $1', [id]);
        if (is_top_university && top_stream_ids && top_stream_ids.length > 0) {
            const topStreamValues = top_stream_ids.map(streamId => `(${id}, ${streamId})`).join(',');
            await client.query(`INSERT INTO top_university_streams (university_id, stream_id) VALUES ${topStreamValues}`);
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error updating university with ID ${id}:`, err);
        if (err.code === '23505') return res.status(409).json({ message: "A university with this name already exists." });
        res.status(500).json({ message: "Error updating university" });
    } finally {
        client.release();
    }
};



// Delete a university
export const deleteUniversity = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM universities WHERE id=$1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: "University not found" });
        res.status(204).send(); // No Content
    } catch (err) {
        console.error(`Error deleting university with ID ${id}:`, err);
        res.status(500).json({ message: "Error deleting university" });
    }
};