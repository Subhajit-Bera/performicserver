import bcrypt from 'bcryptjs';
import pool, { closePool } from '../config/db.mjs';

export const runSeed = async () => {
    const client = await pool.connect();
    try {
        console.log('[seed] Starting database seeding...');
        await client.query('BEGIN');

        // 1. Streams
        const streams = [
            { name: 'Engineering', slug: 'engineering' },
            { name: 'Management', slug: 'management' },
            { name: 'Medical', slug: 'medical' },
            { name: 'Science', slug: 'science' },
            { name: 'Design & Architecture', slug: 'design-architecture' },
        ];
        const streamMap = new Map();
        for (const s of streams) {
            const res = await client.query(
                `INSERT INTO streams (name, slug)
                 VALUES ($1, $2)
                 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id, slug`,
                [s.name, s.slug]
            );
            streamMap.set(s.slug, res.rows[0].id);
        }

        // 2. Courses
        const courses = [
            { name: 'B.Tech Computer Science & Engineering', slug: 'btech-cse', description: 'Flagship 4-year undergraduate program in computing and AI systems.', icon_name: 'Cpu' },
            { name: 'B.Tech Electronics & Communication', slug: 'btech-ece', description: 'Core program covering embedded systems, VLSI, and signal processing.', icon_name: 'Radio' },
            { name: 'Master of Business Administration (MBA)', slug: 'mba-general', description: 'Premier 2-year leadership and management program.', icon_name: 'Briefcase' },
            { name: 'Bachelor of Medicine, Bachelor of Surgery (MBBS)', slug: 'mbbs', description: '5.5-year clinical medical program with mandatory rotatory internship.', icon_name: 'HeartPulse' },
            { name: 'B.Des Industrial & Product Design', slug: 'bdes-design', description: 'Rigorous studio program focused on user ergonomics and physical-digital products.', icon_name: 'Palette' },
            { name: 'B.Sc Data Science & AI', slug: 'bsc-data-science', description: 'Modern 3-year quantitative curriculum covering machine learning, statistics, and cloud data engineering.', icon_name: 'Database' },
        ];
        const courseMap = new Map();
        for (const c of courses) {
            const res = await client.query(
                `INSERT INTO courses (name, slug, description, icon_name)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
                 RETURNING id, slug`,
                [c.name, c.slug, c.description, c.icon_name]
            );
            courseMap.set(c.slug, res.rows[0].id);
        }

        // Link Stream -> Courses
        const streamCourseLinks = [
            ['engineering', 'btech-cse'],
            ['engineering', 'btech-ece'],
            ['management', 'mba-general'],
            ['medical', 'mbbs'],
            ['design-architecture', 'bdes-design'],
            ['science', 'bsc-data-science'],
        ];
        for (const [streamSlug, courseSlug] of streamCourseLinks) {
            const streamId = streamMap.get(streamSlug);
            const courseId = courseMap.get(courseSlug);
            if (streamId && courseId) {
                await client.query(
                    `INSERT INTO stream_courses (stream_id, course_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [streamId, courseId]
                );
            }
        }

        // 3. Universities
        const universities = [
            {
                name: 'Indian Institute of Technology, Bombay',
                slug: 'iit-bombay',
                location: 'Powai, Mumbai, Maharashtra',
                rating: 4.9,
                image_url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=900&auto=format&fit=crop&q=80',
                description: 'Recognized worldwide as a premier center of technical education and research. Set on the banks of Powai Lake.',
                is_top: true,
                streams: ['engineering', 'science'],
                courses: [
                    { slug: 'btech-cse', fee: 220000, fee_display: 'Rs 2.2 Lakhs / year', duration: '4 Years', eligibility: 'JEE Advanced top 200 rank' },
                    { slug: 'btech-ece', fee: 220000, fee_display: 'Rs 2.2 Lakhs / year', duration: '4 Years', eligibility: 'JEE Advanced top 600 rank' },
                ],
            },
            {
                name: 'Birla Institute of Technology and Science, Pilani',
                slug: 'bits-pilani',
                location: 'Pilani, Rajasthan',
                rating: 4.8,
                image_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=900&auto=format&fit=crop&q=80',
                description: 'All-India Institute for higher education deemed to be a university by UGC. Known for zero-attendance policy and Practice School.',
                is_top: true,
                streams: ['engineering', 'science'],
                courses: [
                    { slug: 'btech-cse', fee: 520000, fee_display: 'Rs 5.2 Lakhs / year', duration: '4 Years', eligibility: 'BITSAT score 320+' },
                    { slug: 'bsc-data-science', fee: 420000, fee_display: 'Rs 4.2 Lakhs / year', duration: '3 Years', eligibility: 'Class 12 80%+ PCM' },
                ],
            },
            {
                name: 'Indian Institute of Management, Ahmedabad',
                slug: 'iim-ahmedabad',
                location: 'Vastrapur, Ahmedabad, Gujarat',
                rating: 4.9,
                image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&auto=format&fit=crop&q=80',
                description: 'The foremost management institute in India, consistently ranked amongst the top business schools globally.',
                is_top: true,
                streams: ['management'],
                courses: [
                    { slug: 'mba-general', fee: 1250000, fee_display: 'Rs 25 Lakhs (2-Year Program)', duration: '2 Years', eligibility: 'CAT 99+ percentile and interview' },
                ],
            },
            {
                name: 'All India Institute of Medical Sciences',
                slug: 'aiims-new-delhi',
                location: 'Ansari Nagar, New Delhi, Delhi',
                rating: 4.9,
                image_url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=900&auto=format&fit=crop&q=80',
                description: 'Apex healthcare institute of India, established by an Act of Parliament with state-of-the-art super-specialty research wings.',
                is_top: true,
                streams: ['medical'],
                courses: [
                    { slug: 'mbbs', fee: 1628, fee_display: 'Subsidized Central Merit', duration: '5.5 Years', eligibility: 'NEET UG top 50 AIR rank' },
                ],
            },
            {
                name: 'National Institute of Design',
                slug: 'nid-ahmedabad',
                location: 'Paldi, Ahmedabad, Gujarat',
                rating: 4.7,
                image_url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&auto=format&fit=crop&q=80',
                description: 'Institute of National Importance internationally renowned for education and research in industrial, textile, and communication design.',
                is_top: true,
                streams: ['design-architecture'],
                courses: [
                    { slug: 'bdes-design', fee: 350000, fee_display: 'Rs 3.5 Lakhs / year', duration: '4 Years', eligibility: 'NID DAT Prelims & Mains' },
                ],
            },
        ];

        for (const u of universities) {
            const uniRes = await client.query(
                `INSERT INTO universities (
                    name, slug, location, rating, image_url, description,
                    admission_open, admission_year, is_top_university
                 ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, 2026, $7)
                 ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    location = EXCLUDED.location,
                    rating = EXCLUDED.rating,
                    image_url = EXCLUDED.image_url,
                    description = EXCLUDED.description,
                    admission_open = TRUE,
                    is_top_university = EXCLUDED.is_top_university
                 RETURNING id`,
                [u.name, u.slug, u.location, u.rating, u.image_url, u.description, u.is_top]
            );
            const universityId = uniRes.rows[0].id;

            // Junctions: streams & top_streams
            for (const streamSlug of u.streams) {
                const streamId = streamMap.get(streamSlug);
                if (streamId) {
                    await client.query(
                        `INSERT INTO university_streams (university_id, stream_id)
                         VALUES ($1, $2)
                         ON CONFLICT DO NOTHING`,
                        [universityId, streamId]
                    );
                    if (u.is_top) {
                        await client.query(
                            `INSERT INTO top_university_streams (university_id, stream_id)
                             VALUES ($1, $2)
                             ON CONFLICT DO NOTHING`,
                            [universityId, streamId]
                        );
                    }
                }
            }

            // Offerings
            for (const courseOffer of u.courses) {
                const courseId = courseMap.get(courseOffer.slug);
                if (courseId) {
                    await client.query(
                        `INSERT INTO university_course_offerings (
                            university_id, course_id, fee_amount, fee_display, duration, eligibility, admission_year
                         ) VALUES ($1, $2, $3, $4, $5, $6, 2026)
                         ON CONFLICT (university_id, course_id) DO UPDATE SET
                            fee_amount = EXCLUDED.fee_amount,
                            fee_display = EXCLUDED.fee_display,
                            duration = EXCLUDED.duration,
                            eligibility = EXCLUDED.eligibility`,
                        [universityId, courseId, courseOffer.fee, courseOffer.fee_display, courseOffer.duration, courseOffer.eligibility]
                    );
                }
            }
        }

        // 4. Exams
        const exams = [
            {
                name: 'JEE Main 2026',
                slug: 'jee-mains',
                exam_date: 'April 4 - 15, 2026',
                exam_level: 'National Level',
                info: { mode: 'Computer Based Test (CBT)', conducting_body: 'National Testing Agency (NTA)', frequency: 'Twice a year' },
            },
            {
                name: 'NEET UG 2026',
                slug: 'neet',
                exam_date: 'May 3, 2026',
                exam_level: 'National Level',
                info: { mode: 'Pen and Paper (OMR)', conducting_body: 'National Testing Agency (NTA)', frequency: 'Once a year' },
            },
            {
                name: 'CAT 2026',
                slug: 'cat',
                exam_date: 'November 29, 2026',
                exam_level: 'National Level',
                info: { mode: 'Computer Based Test (CBT)', conducting_body: 'Indian Institute of Management', frequency: 'Once a year' },
            },
            {
                name: 'BITSAT 2026',
                slug: 'bitsat',
                exam_date: 'May 20 - 24, 2026',
                exam_level: 'University Level',
                info: { mode: 'Online CBT', conducting_body: 'BITS Pilani', frequency: 'Two Sessions' },
            },
            {
                name: 'NID DAT 2027',
                slug: 'nid-dat',
                exam_date: 'January 10, 2027',
                exam_level: 'National Level',
                info: { mode: 'Design Studio & Written Test', conducting_body: 'National Institute of Design', frequency: 'Annual' },
            },
        ];

        for (const ex of exams) {
            await client.query(
                `INSERT INTO exams (name, slug, exam_date, exam_level, info)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    exam_date = EXCLUDED.exam_date,
                    exam_level = EXCLUDED.exam_level,
                    info = EXCLUDED.info`,
                [ex.name, ex.slug, ex.exam_date, ex.exam_level, JSON.stringify(ex.info)]
            );
        }

        // 5. Partners
        const partners = [
            { name: 'Google Cloud Education', location: 'Bangalore, India', featured_text: 'Cloud certification curriculum & student developer labs', logo_url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=120&auto=format&fit=crop&q=80', stream: 'engineering' },
            { name: 'Microsoft Enterprise', location: 'Hyderabad, India', featured_text: 'Campus hiring & Azure AI incubation programs', logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80', stream: 'engineering' },
            { name: 'Deloitte Consulting', location: 'Mumbai, India', featured_text: 'Strategic case study competitions & executive mentorship', logo_url: 'https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=120&auto=format&fit=crop&q=80', stream: 'management' },
            { name: 'Amazon Web Services', location: 'Bangalore, India', featured_text: 'Undergraduate deep learning fellowships & cloud credits', logo_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=120&auto=format&fit=crop&q=80', stream: 'engineering' },
        ];

        for (const p of partners) {
            await client.query(
                `INSERT INTO partners (name, location, featured_text, logo_url, link_stream_slug)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT DO NOTHING`,
                [p.name, p.location, p.featured_text, p.logo_url, p.stream]
            );
        }

        // 6. Default Admin and Test User
        const adminPassHash = await bcrypt.hash('Admin@12345', 10);
        await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone_number, state_hometown, choice_of_stream, entry_level)
             VALUES ($1, $2, $3, 'admin'::user_role, $4, $5, $6, $7)
             ON CONFLICT (email) DO UPDATE SET role = 'admin'::user_role, password_hash = EXCLUDED.password_hash`,
            ['System Administrator', 'admin@performic.com', adminPassHash, '9876543210', 'Maharashtra', 'Engineering', 'Graduate']
        );

        const agentPassHash = await bcrypt.hash('Agent@12345', 10);
        await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone_number, state_hometown, choice_of_stream, entry_level)
             VALUES ($1, $2, $3, 'agent'::user_role, $4, $5, $6, $7)
             ON CONFLICT (email) DO UPDATE SET role = 'agent'::user_role, password_hash = EXCLUDED.password_hash`,
            ['Campus Ambassador', 'agent@performic.com', agentPassHash, '9876543211', 'Karnataka', 'Engineering', 'Graduate']
        );

        await client.query('COMMIT');
        console.log('[seed] Seeding completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[seed] Seeding failed:', err);
        throw err;
    } finally {
        client.release();
    }
};

if (process.argv[1]?.endsWith('seed.mjs')) {
    runSeed()
        .then(() => closePool())
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
