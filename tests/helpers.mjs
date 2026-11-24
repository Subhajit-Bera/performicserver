import bcrypt from 'bcryptjs';
import pool, { closePool } from '../config/db.mjs';

export const TEST_PASSWORD = 'Sup3rSecret!';

export const resetDatabase = async () => {
    await pool.query(`
        TRUNCATE TABLE
            application_status_history,
            appointment_status_history,
            oauth_codes,
            sessions,
            contact_messages,
            applications,
            appointments,
            university_course_offerings,
            top_university_streams,
            university_streams,
            stream_courses,
            users,
            universities,
            courses,
            exams,
            partners,
            streams
        RESTART IDENTITY CASCADE
    `);
};

export const teardown = async () => {
    await closePool();
};

export const seedUser = async ({
    email,
    password = TEST_PASSWORD,
    role = 'user',
    fullName = 'Test User',
    completeProfile = true,
    referredBy = null,
    referralStatus = 'Not Referred',
}) => {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
        `INSERT INTO users
            (full_name, email, password_hash, role, phone_number, whatsapp_number,
             state_hometown, choice_of_stream, entry_level, how_heard,
             referred_by, referral_status)
         VALUES ($1, lower($2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, full_name, email, role, referral_status`,
        [
            fullName,
            email,
            hash,
            role,
            completeProfile ? '9876543210' : null,
            completeProfile ? '9876543210' : null,
            completeProfile ? 'Karnataka' : null,
            completeProfile ? 'Engineering' : null,
            completeProfile ? 'After 12th' : null,
            completeProfile ? 'Friend referral' : null,
            referredBy,
            referralStatus,
        ]
    );
    return result.rows[0];
};

export const seedUniversity = async ({
    name = 'Test University',
    admissionOpen = true,
    rating = 4.2,
    location = 'Bengaluru, Karnataka',
    isTop = false,
}) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const result = await pool.query(
        `INSERT INTO universities
            (name, slug, location, rating, description, image_url, details, courses_and_fees,
             placements, facilities, admission_open, admission_year, is_top_university)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id, name, slug, city_slug, admission_open`,
        [
            name, slug, location, rating, 'Seeded for tests', null, '{}', '[]', '{}', [],
            admissionOpen, 2026, isTop,
        ]
    );
    return result.rows[0];
};

export const seedCourse = async ({ name = 'B.Tech Computer Science', iconName = 'cpu' } = {}) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const result = await pool.query(
        'INSERT INTO courses (name, slug, description, icon_name) VALUES ($1,$2,$3,$4) RETURNING id, name, slug',
        [name, slug, 'Seeded course', iconName]
    );
    return result.rows[0];
};

export const seedStream = async ({ name = 'Engineering' } = {}) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const result = await pool.query(
        'INSERT INTO streams (name, slug) VALUES ($1,$2) RETURNING id, name, slug',
        [name, slug]
    );
    return result.rows[0];
};

export const linkUniversityStream = async (universityId, streamId, { top = false } = {}) => {
    await pool.query(
        'INSERT INTO university_streams (university_id, stream_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [universityId, streamId]
    );
    if (top) {
        await pool.query(
            'INSERT INTO top_university_streams (university_id, stream_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [universityId, streamId]
        );
    }
};
