import pool, { closePool } from '../config/db.mjs';

async function check() {
    try {
        const counts = await pool.query(`
            SELECT 'universities' AS tbl, count(*)::int AS total FROM universities
            UNION ALL SELECT 'courses', count(*)::int FROM courses
            UNION ALL SELECT 'exams', count(*)::int FROM exams
            UNION ALL SELECT 'partners', count(*)::int FROM partners
            UNION ALL SELECT 'users', count(*)::int FROM users
            UNION ALL SELECT 'offerings', count(*)::int FROM university_course_offerings;
        `);
        console.log('\n=== NEON DATABASE LIVE ROW COUNTS ===');
        console.table(counts.rows);

        const sampleUni = await pool.query('SELECT name, location, rating FROM universities LIMIT 5;');
        console.log('\n=== UNIVERSITIES CURRENTLY IN NEON ===');
        console.table(sampleUni.rows);

        const sampleUsers = await pool.query('SELECT full_name, email, role FROM users LIMIT 5;');
        console.log('\n=== USERS CURRENTLY IN NEON ===');
        console.table(sampleUsers.rows);
    } catch (err) {
        console.error('Error querying Neon:', err.message);
    } finally {
        await closePool();
    }
}

check();
