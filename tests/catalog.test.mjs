import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app.mjs';
import pool from '../config/db.mjs';
import {
    resetDatabase, teardown, seedUser, seedUniversity, seedCourse, seedStream,
    linkUniversityStream, TEST_PASSWORD,
} from './helpers.mjs';

const login = async (email) => {
    const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
    assert.equal(res.status, 200);
    return res.body.accessToken;
};

describe('public catalog and admin CRUD', () => {
    let adminToken;
    let stream;
    let course;
    let topUniversity;

    before(async () => {
        await resetDatabase();
        const admin = await seedUser({ email: 'admin@performic.test', role: 'admin', fullName: 'Admin One' });
        adminToken = await login('admin@performic.test');

        stream = await seedStream({ name: 'Engineering' });
        course = await seedCourse({ name: 'B.Tech Computer Science' });

        await seedUniversity({ name: 'Alpha Institute', location: 'Bengaluru, Karnataka', rating: 4.8 });
        topUniversity = await seedUniversity({
            name: 'Beta Institute', location: 'Pune, Maharashtra', rating: 4.1, isTop: true,
        });
        await linkUniversityStream(topUniversity.id, stream.id, { top: true });
        await pool.query(
            `INSERT INTO university_course_offerings (university_id, course_id, fee_amount, fee_display)
             VALUES ($1, $2, 150000, '₹1.5L / year')`,
            [topUniversity.id, course.id]
        );
        await pool.query(
            'INSERT INTO stream_courses (stream_id, course_id) VALUES ($1, $2)',
            [stream.id, course.id]
        );
        await pool.query(
            `INSERT INTO exams (name, slug, exam_date, exam_level, info)
             VALUES ('Joint Entrance Test', 'joint-entrance-test', '2026-04-10', 'National', $1)`,
            [JSON.stringify({ summary: 'Seeded exam' })]
        );
        await pool.query(
            `INSERT INTO partners (name, location, featured_text, logo_url, link_stream_slug, link_city_slug)
             VALUES ('Career Partner', 'Mumbai', 'Featured', 'https://example.com/logo.png', 'engineering', 'pune')`
        );
    });
    after(teardown);

    test('GET /api/universities returns an array with aggregated streams and city_slug', async () => {
        const res = await request(app).get('/api/universities');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
        const beta = res.body.find((u) => u.name === 'Beta Institute');
        assert.deepEqual(beta.streams, ['Engineering']);
        assert.deepEqual(beta.stream_slugs, ['engineering']);
        assert.equal(beta.city_slug, 'pune');
    });

    test('university filters narrow the result set server-side', async () => {
        const byCity = await request(app).get('/api/universities?city=pune');
        assert.equal(byCity.status, 200);
        assert.deepEqual(byCity.body.map((u) => u.name), ['Beta Institute']);

        const byStream = await request(app).get('/api/universities?stream=engineering');
        assert.deepEqual(byStream.body.map((u) => u.name), ['Beta Institute']);

        const top = await request(app).get('/api/universities?filter=top');
        assert.deepEqual(top.body.map((u) => u.name), ['Beta Institute']);

        const search = await request(app).get('/api/universities?search=alpha');
        assert.deepEqual(search.body.map((u) => u.name), ['Alpha Institute']);

        const none = await request(app).get('/api/universities?city=nowhere');
        assert.deepEqual(none.body, []);
    });

    test('invalid university filter values are rejected', async () => {
        const res = await request(app).get('/api/universities?filter=bogus');
        assert.equal(res.status, 400);
    });

    test('top-by-stream groups universities under their stream', async () => {
        const res = await request(app).get('/api/universities/top-by-stream');
        assert.equal(res.status, 200);
        assert.equal(res.body.length, 1);
        assert.equal(res.body[0].stream_slug, 'engineering');
        assert.equal(res.body[0].universities.length, 1);
    });

    test('university by slug returns offerings, unknown slug returns 404', async () => {
        const found = await request(app).get(`/api/universities/${topUniversity.slug}`);
        assert.equal(found.status, 200);
        assert.equal(found.body.offerings.length, 1);
        assert.equal(found.body.offerings[0].course_name, 'B.Tech Computer Science');

        const missing = await request(app).get('/api/universities/no-such-university');
        assert.equal(missing.status, 404);
    });

    test('course by slug resolves universities through the offerings table', async () => {
        const res = await request(app).get(`/api/courses/${course.slug}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.course.id, course.id);
        assert.deepEqual(res.body.streams.map((s) => s.slug), ['engineering']);
        assert.equal(res.body.universities.length, 1);
        assert.equal(res.body.universities[0].name, 'Beta Institute');
        assert.equal(Number(res.body.universities[0].fee_amount), 150000);
    });

    test('exams, streams and partners endpoints stay public and cached', async () => {
        const exams = await request(app).get('/api/exams');
        assert.equal(exams.status, 200);
        assert.equal(exams.body.length, 1);
        assert.match(exams.headers['cache-control'], /max-age/);

        const exam = await request(app).get('/api/exams/joint-entrance-test');
        assert.equal(exam.status, 200);
        assert.equal(exam.body.name, 'Joint Entrance Test');

        const missingExam = await request(app).get('/api/exams/nope');
        assert.equal(missingExam.status, 404);

        const streams = await request(app).get('/api/streams');
        assert.equal(streams.status, 200);
        assert.deepEqual(streams.body[0].course_ids, [course.id]);

        const partners = await request(app).get('/api/partners');
        assert.equal(partners.status, 200);
        assert.equal(partners.body.length, 1);
    });

    test('contact submissions are stored and rate-limited by design', async () => {
        const res = await request(app)
            .post('/api/contact')
            .send({ name: 'Visitor', email: 'visitor@example.com', message: 'Please call me back' });
        assert.equal(res.status, 201);

        const rows = await pool.query('SELECT name, email, message FROM contact_messages');
        assert.equal(rows.rows.length, 1);
        assert.equal(rows.rows[0].email, 'visitor@example.com');

        const invalid = await request(app).post('/api/contact').send({ name: 'X', email: 'nope', message: '' });
        assert.equal(invalid.status, 400);
    });

    test('admin can create, read, update and delete a university', async () => {
        const created = await request(app)
            .post('/api/admin/universities')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Gamma Institute',
                location: 'Jaipur, Rajasthan',
                rating: 3.9,
                admission_open: true,
                admission_year: 2026,
                stream_ids: [stream.id],
                is_top_university: true,
                top_stream_ids: [stream.id],
                offerings: [{ course_id: course.id, fee_amount: 90000, duration: '4 years' }],
            });
        assert.equal(created.status, 201);
        const id = created.body.id;

        const read = await request(app)
            .get(`/api/admin/universities/${id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(read.status, 200);
        assert.deepEqual(read.body.stream_ids, [stream.id]);
        assert.deepEqual(read.body.top_stream_ids, [stream.id]);
        assert.equal(read.body.offerings.length, 1);

        const updated = await request(app)
            .put(`/api/admin/universities/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ...read.body, name: 'Gamma Institute Renamed', rating: 4.4, stream_ids: [stream.id] });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.name, 'Gamma Institute Renamed');

        const list = await request(app)
            .get('/api/admin/universities?search=Gamma')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(list.status, 200);
        assert.equal(list.body.meta.total, 1);
        assert.equal(list.body.data[0].stream_name, 'Engineering');

        const removed = await request(app)
            .delete(`/api/admin/universities/${id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(removed.status, 204);
    });

    test('duplicate university names surface as a 409 conflict', async () => {
        const res = await request(app)
            .post('/api/admin/universities')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Alpha Institute', location: 'Bengaluru, Karnataka' });
        assert.equal(res.status, 409);
    });

    test('admin exam CRUD validates payloads and reports 404s', async () => {
        const created = await request(app)
            .post('/api/admin/exams')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'New Entrance Exam', exam_level: 'State', important_dates: { registration: '2026-01-05' } });
        assert.equal(created.status, 201);
        assert.deepEqual(created.body.important_dates, { registration: '2026-01-05' });

        const invalid = await request(app)
            .post('/api/admin/exams')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'x' });
        assert.equal(invalid.status, 400);

        const missing = await request(app)
            .get('/api/admin/exams/999999')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(missing.status, 404);

        const removed = await request(app)
            .delete(`/api/admin/exams/${created.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(removed.status, 204);

        const removedAgain = await request(app)
            .delete(`/api/admin/exams/${created.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(removedAgain.status, 404);
    });

    test('admin stream CRUD guards course links', async () => {
        const created = await request(app)
            .post('/api/admin/streams')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Design' });
        assert.equal(created.status, 201);

        const badLink = await request(app)
            .put(`/api/admin/streams/${created.body.id}/courses`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ course_ids: [999999] });
        assert.equal(badLink.status, 400);

        const goodLink = await request(app)
            .put(`/api/admin/streams/${created.body.id}/courses`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ course_ids: [course.id] });
        assert.equal(goodLink.status, 200);

        const byStreams = await request(app)
            .get(`/api/admin/courses-by-streams?stream_ids=${created.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(byStreams.status, 200);
        assert.deepEqual(byStreams.body.map((c) => c.id), [course.id]);

        const removed = await request(app)
            .delete(`/api/admin/streams/${created.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(removed.status, 204);
    });

    test('admin partner CRUD validates urls and reports missing rows', async () => {
        const invalid = await request(app)
            .post('/api/admin/partners')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Bad Partner', logo_url: 'ftp://nope' });
        assert.equal(invalid.status, 400);

        const created = await request(app)
            .post('/api/admin/partners')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Good Partner', logo_url: 'https://example.com/good.png' });
        assert.equal(created.status, 201);

        const missing = await request(app)
            .put('/api/admin/partners/999999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Ghost' });
        assert.equal(missing.status, 404);

        const removed = await request(app)
            .delete(`/api/admin/partners/${created.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(removed.status, 204);
    });

    test('admin course list is paginated', async () => {
        const res = await request(app)
            .get('/api/admin/courses?page=1&limit=1')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.length, 1);
        assert.equal(res.body.meta.total, 1);
        assert.equal(res.body.meta.totalPages, 1);
    });

    test('pagination limit is capped at 100', async () => {
        const res = await request(app)
            .get('/api/admin/users?limit=1000')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.meta.limit, 100);
    });

    test('course stream links are written on create and replaced on update', async () => {
        const stream = await request(app)
            .post('/api/admin/streams')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Marine Biology' });
        assert.equal(stream.status, 201);

        const created = await request(app)
            .post('/api/admin/courses')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Aquaculture', description: 'Fish farming', icon_name: 'Fish', stream_ids: [stream.body.id] });
        assert.equal(created.status, 201);

        const loaded = await request(app)
            .get(`/api/admin/courses/${created.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(loaded.status, 200);
        assert.deepEqual(loaded.body.stream_ids, [stream.body.id]);

        const cleared = await request(app)
            .put(`/api/admin/courses/${created.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Aquaculture', stream_ids: [] });
        assert.equal(cleared.status, 200);

        const reloaded = await request(app)
            .get(`/api/admin/courses/${created.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.deepEqual(reloaded.body.stream_ids, []);
    });
});
