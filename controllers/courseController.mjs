// import pool from '../config/db.mjs';

// // Get all courses for the homepage component
// export const getAllCourses = async (req, res) => {
//     try {
//         const result = await pool.query('SELECT id, name, slug, icon_name FROM courses ORDER BY name');
//         res.json(result.rows);
//     } catch (err) {
//         res.status(500).json({ message: 'Error fetching courses' });
//     }
// };

// // Get a single course by slug and its related universities
// export const getCourseBySlug = async (req, res) => {
//     try {
//         const courseResult = await pool.query('SELECT * FROM courses WHERE slug = $1', [req.params.slug]);
//         if (courseResult.rows.length === 0) {
//             return res.status(404).json({ message: 'Course not found' });
//         }
//         const course = courseResult.rows[0];

//         let universities = [];
//         if (course.related_university_ids && course.related_university_ids.length > 0) {
//             const universitiesResult = await pool.query(`
//                 SELECT u.id, u.name, u.slug, u.location, u.image_url, u.rating, array_agg(s.name) as streams
//                 FROM universities u
//                 LEFT JOIN university_streams us ON u.id = us.university_id
//                 LEFT JOIN streams s ON us.stream_id = s.id
//                 WHERE u.id = ANY($1::int[])
//                 GROUP BY u.id
//             `, [course.related_university_ids]);
//             universities = universitiesResult.rows;
//         }

//         res.json({ course, universities });
//     } catch (err) {
//         res.status(500).json({ message: 'Error fetching course details' });
//     }
// };





import pool from '../config/db.mjs';

// Get all courses for the homepage "Career Options" component
export const getAllCourses = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, slug, icon_name FROM courses ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching courses:", err);
        res.status(500).json({ message: 'Error fetching courses' });
    }
};

// Get a single course by its slug and find all universities related to it
// export const getCourseBySlug = async (req, res) => {
//     try {
//         const courseResult = await pool.query('SELECT * FROM courses WHERE slug = $1', [req.params.slug]);
//         if (courseResult.rows.length === 0) {
//             return res.status(404).json({ message: 'Course not found' });
//         }
//         console.log("Courses found:", courseResult.rows);
//         const course = courseResult.rows[0];
//         console.log("Course found:", courseResult.rows[0]);

//         // Find all streams this course is linked to
//         const streamResult = await pool.query('SELECT stream_id FROM stream_courses WHERE course_id = $1', [course.id]);
//         console.log("Streams linked to course:", streamResult.rows);
//         const streamIds = streamResult.rows.map(r => r.stream_id);

//         let universities = [];
//         if (streamIds.length > 0) {
//             // Find all universities that have AT LEAST ONE of the required streams
//             const universitiesResult = await pool.query(`
//                 SELECT u.id, u.name, u.slug, u.location, u.image_url, u.rating, array_agg(s.name) as streams
//                 FROM universities u
//                 LEFT JOIN university_streams us ON u.id = us.university_id
//                 LEFT JOIN streams s ON us.stream_id = s.id
//                 WHERE u.id IN (SELECT university_id FROM university_streams WHERE stream_id = ANY($1::int[]))
//                 GROUP BY u.id
//             `, [streamIds]);
//             universities = universitiesResult.rows;
//             console.log("Universities found:", universitiesResult.rows)
//         }

//         res.json({ course, universities });
//     } catch (err) {
//         console.error(`Error fetching course details for slug ${req.params.slug}:`, err);
//         res.status(500).json({ message: 'Error fetching course details' });
//     }
// };


export const getCourseBySlug = async (req, res) => {
    try {
        // Step 1: Find the course details by its slug
        const courseResult = await pool.query('SELECT * FROM courses WHERE slug = $1', [req.params.slug]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }
        const course = courseResult.rows[0];

        // Step 2: THE FIX - Find universities where the `courses_and_fees` JSONB array
        // contains an object with a "course" key matching our course name.
        const universitiesResult = await pool.query(`
            SELECT u.id, u.name, u.slug, u.location, u.image_url, u.rating, array_agg(s.name) as streams
            FROM universities u
            LEFT JOIN university_streams us ON u.id = us.university_id
            LEFT JOIN streams s ON us.stream_id = s.id
            WHERE u.courses_and_fees @> $1::jsonb
            GROUP BY u.id
        `, [
            // This creates a JSON search query like: '[{"course": "B.TECH"}]'
            JSON.stringify([{ course: course.name }])
        ]);
        
        const universities = universitiesResult.rows;

        res.json({ course, universities });
    } catch (err) {
        console.error(`Error fetching course details for slug ${req.params.slug}:`, err);
        res.status(500).json({ message: 'Error fetching course details' });
    }
};