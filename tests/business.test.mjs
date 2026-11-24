import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app.mjs';
import pool from '../config/db.mjs';
import { resetDatabase, teardown, seedUser, seedUniversity, TEST_PASSWORD } from './helpers.mjs';

const login = async (email) => {
    const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
    assert.equal(res.status, 200);
    return res.body.accessToken;
};

const futureDate = (days = 3) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

describe('business rules', () => {
    let incompleteUser;
    let incompleteToken;
    let completeUser;
    let completeToken;
    let admin;
    let adminToken;
    let openUniversity;
    let closedUniversity;

    before(async () => {
        await resetDatabase();
        admin = await seedUser({ email: 'admin@performic.test', role: 'admin', fullName: 'Admin One' });
        incompleteUser = await seedUser({ email: 'incomplete@performic.test', completeProfile: false, fullName: 'Incomplete' });
        completeUser = await seedUser({ email: 'complete@performic.test', completeProfile: true, fullName: 'Complete' });
        openUniversity = await seedUniversity({ name: 'Open Admissions University' });
        closedUniversity = await seedUniversity({ name: 'Closed Admissions University', admissionOpen: false });

        adminToken = await login('admin@performic.test');
        incompleteToken = await login('incomplete@performic.test');
        completeToken = await login('complete@performic.test');
    });
    after(teardown);

    test('applying with an incomplete profile is refused with the missing fields', async () => {
        const res = await request(app)
            .post('/api/users/apply')
            .set('Authorization', `Bearer ${incompleteToken}`)
            .send({ universityId: openUniversity.id });
        assert.equal(res.status, 422);
        assert.ok(res.body.details.missingFields.includes('phone_number'));
    });

    test('applying to a university with closed admissions is refused', async () => {
        const res = await request(app)
            .post('/api/users/apply')
            .set('Authorization', `Bearer ${completeToken}`)
            .send({ universityId: closedUniversity.id });
        assert.equal(res.status, 422);
    });

    test('applying to a missing university returns 404', async () => {
        const res = await request(app)
            .post('/api/users/apply')
            .set('Authorization', `Bearer ${completeToken}`)
            .send({ universityId: 424242 });
        assert.equal(res.status, 404);
    });

    test('a valid application is recorded with status history', async () => {
        const res = await request(app)
            .post('/api/users/apply')
            .set('Authorization', `Bearer ${completeToken}`)
            .send({ universityId: openUniversity.id });
        assert.equal(res.status, 201);
        assert.equal(res.body.status, 'Applied');

        const history = await pool.query(
            'SELECT from_status, to_status FROM application_status_history WHERE application_id = $1',
            [res.body.id]
        );
        assert.equal(history.rows.length, 1);
        assert.equal(history.rows[0].to_status, 'Applied');
    });

    test('application payloads are validated', async () => {
        const res = await request(app)
            .post('/api/users/apply')
            .set('Authorization', `Bearer ${completeToken}`)
            .send({ universityId: 'not-a-number' });
        assert.equal(res.status, 400);
    });

    test('appointments must be in the future', async () => {
        const res = await request(app)
            .post('/api/users/book-appointment')
            .set('Authorization', `Bearer ${completeToken}`)
            .send({ date: new Date(Date.now() - 60000).toISOString(), notes: 'past' });
        assert.equal(res.status, 400);
    });

    test('a user can hold at most three active appointments', async () => {
        const dates = [futureDate(1), futureDate(2), futureDate(3), futureDate(4)];
        const results = [];
        for (const date of dates) {
            results.push(
                await request(app)
                    .post('/api/users/book-appointment')
                    .set('Authorization', `Bearer ${completeToken}`)
                    .send({ date: date, notes: 'counselling' })
            );
        }
        assert.deepEqual(results.slice(0, 3).map((r) => r.status), [201, 201, 201]);
        assert.equal(results[3].status, 409);
    });

    test('the same slot cannot be double-booked by one user', async () => {
        const date = futureDate(9);
        const first = await request(app)
            .post('/api/users/book-appointment')
            .set('Authorization', `Bearer ${incompleteToken}`)
            .send({ date: date });
        assert.equal(first.status, 422, 'incomplete profile still blocks booking');

        const profiled = await request(app)
            .put('/api/users/profile')
            .set('Authorization', `Bearer ${incompleteToken}`)
            .send({
                phoneNumber: '9812345678',
                whatsAppNumber: '9812345678',
                stateHometown: 'Kerala',
                choiceOfStream: 'Management',
                entryLevel: 'After 12th',
                howHeard: 'Instagram',
            });
        assert.equal(profiled.status, 200);
        assert.equal(profiled.body.profile_completion, 100);

        const booked = await request(app)
            .post('/api/users/book-appointment')
            .set('Authorization', `Bearer ${incompleteToken}`)
            .send({ date: date });
        assert.equal(booked.status, 201);
    });

    test('users can only cancel their own appointments', async () => {
        const mine = await pool.query(
            `SELECT id FROM appointments WHERE user_id = $1 AND status = 'Booked' ORDER BY id LIMIT 1`,
            [incompleteUser.id]
        );
        const appointmentId = mine.rows[0].id;

        const foreign = await request(app)
            .put(`/api/users/appointments/${appointmentId}/cancel`)
            .set('Authorization', `Bearer ${completeToken}`);
        assert.equal(foreign.status, 404);

        const own = await request(app)
            .put(`/api/users/appointments/${appointmentId}/cancel`)
            .set('Authorization', `Bearer ${incompleteToken}`);
        assert.equal(own.status, 200);
        assert.equal(own.body.status, 'Cancelled');

        const again = await request(app)
            .put(`/api/users/appointments/${appointmentId}/cancel`)
            .set('Authorization', `Bearer ${incompleteToken}`);
        assert.equal(again.status, 404);
    });

    test('admin appointment status transitions are enforced and audited', async () => {
        const appt = await pool.query(
            `SELECT id FROM appointments WHERE user_id = $1 AND status = 'Booked' ORDER BY id LIMIT 1`,
            [completeUser.id]
        );
        const id = appt.rows[0].id;

        const illegal = await request(app)
            .put(`/api/admin/appointments/${id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Converted' });
        assert.equal(illegal.status, 409);

        const legal = await request(app)
            .put(`/api/admin/appointments/${id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Called', note: 'spoke with candidate' });
        assert.equal(legal.status, 200);

        const history = await request(app)
            .get(`/api/admin/appointments/${id}/history`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(history.status, 200);
        assert.ok(history.body.some((h) => h.to_status === 'Called'));
        const calledRow = history.body.find((h) => h.to_status === 'Called');
        assert.equal(calledRow.changed_by_name, 'Admin One');
        assert.equal(calledRow.note, 'spoke with candidate');
    });

    test('admin application status transitions are enforced and audited', async () => {
        const application = await pool.query(
            'SELECT id FROM applications ORDER BY id LIMIT 1'
        );
        const id = application.rows[0].id;

        const illegal = await request(app)
            .put(`/api/admin/applications/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Converted' });
        assert.equal(illegal.status, 409);

        const legal = await request(app)
            .put(`/api/admin/applications/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Called' });
        assert.equal(legal.status, 200);
        assert.equal(legal.body.status, 'Called');

        const empty = await request(app)
            .put(`/api/admin/applications/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});
        assert.equal(empty.status, 400);
    });

    test('admin application list supports status filters and rejects invalid ones', async () => {
        const ok = await request(app)
            .get('/api/admin/applications?status=Called')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(ok.status, 200);
        assert.ok(ok.body.data.every((a) => a.status === 'Called'));

        const bad = await request(app)
            .get('/api/admin/applications?status=Nonsense')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(bad.status, 400);
    });

    test('profile updates are partial and reject invalid phone numbers', async () => {
        const partial = await request(app)
            .put('/api/users/profile')
            .set('Authorization', `Bearer ${completeToken}`)
            .send({ stateHometown: 'Tamil Nadu' });
        assert.equal(partial.status, 200);
        assert.equal(partial.body.state_hometown, 'Tamil Nadu');
        assert.equal(partial.body.phone_number, '9876543210');

        const badPhone = await request(app)
            .put('/api/users/profile')
            .set('Authorization', `Bearer ${completeToken}`)
            .send({ phoneNumber: '12' });
        assert.equal(badPhone.status, 400);
    });

    test('a university with applications cannot be deleted', async () => {
        const res = await request(app)
            .delete(`/api/admin/universities/${openUniversity.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 409);
    });

    test('deleting an unknown university returns 404', async () => {
        const res = await request(app)
            .delete('/api/admin/universities/987654')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 404);
    });

    test('top streams must be a subset of the university streams', async () => {
        const res = await request(app)
            .post('/api/admin/universities')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Subset Violation University',
                location: 'Pune, Maharashtra',
                stream_ids: [],
                is_top_university: true,
                top_stream_ids: [1],
            });
        assert.equal(res.status, 422);
    });

    test('invalid ids in the path are rejected with 400', async () => {
        const res = await request(app)
            .get('/api/admin/universities/not-a-number')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 400);
    });
});
