import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app.mjs';
import pool from '../config/db.mjs';
import { resetDatabase, teardown, seedUser, TEST_PASSWORD } from './helpers.mjs';

const login = async (email) => {
    const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
    assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
    return res.body.accessToken;
};

describe('authorization and admin invariants', () => {
    let adminToken;
    let userToken;
    let agentToken;
    let admin;
    let secondAdmin;
    let regularUser;
    let agent;

    before(async () => {
        await resetDatabase();
        admin = await seedUser({ email: 'admin@performic.test', role: 'admin', fullName: 'Admin One' });
        secondAdmin = await seedUser({ email: 'admin2@performic.test', role: 'admin', fullName: 'Admin Two' });
        regularUser = await seedUser({ email: 'user@performic.test', role: 'user', fullName: 'Regular User' });
        agent = await seedUser({ email: 'agent@performic.test', role: 'agent', fullName: 'Agent Smith' });

        adminToken = await login('admin@performic.test');
        userToken = await login('user@performic.test');
        agentToken = await login('agent@performic.test');
    });
    after(teardown);

    test('regular users cannot reach admin routes (403, not 401)', async () => {
        const res = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${userToken}`);
        assert.equal(res.status, 403);
    });

    test('agents cannot reach admin routes', async () => {
        const res = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${agentToken}`);
        assert.equal(res.status, 403);
    });

    test('admins can list users with pagination metadata and search', async () => {
        const res = await request(app)
            .get('/api/admin/users?page=1&limit=2')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.data));
        assert.equal(res.body.meta.limit, 2);
        assert.equal(res.body.data.length, 2);
        assert.ok(res.body.data.every((u) => u.password_hash === undefined));
        assert.ok(res.body.meta.hasNext);
    });

    test('an admin cannot demote themselves', async () => {
        const res = await request(app)
            .put(`/api/admin/users/${admin.id}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'user' });
        assert.equal(res.status, 400);
    });

    test('demoting another admin leaves exactly one administrator', async () => {
        const res = await request(app)
            .put(`/api/admin/users/${secondAdmin.id}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'agent' });
        assert.equal(res.status, 200);

        const admins = await pool.query(`SELECT count(*)::int AS count FROM users WHERE role = 'admin'`);
        assert.equal(admins.rows[0].count, 1);

        await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [secondAdmin.id]);
    });

    test('role changes revoke the target user sessions', async () => {
        const res = await request(app)
            .put(`/api/admin/users/${regularUser.id}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'agent' });
        assert.equal(res.status, 200);
        assert.equal(res.body.role, 'agent');
        assert.equal(res.body.sessionsRevoked, 1);

        const stale = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${userToken}`);
        assert.equal(stale.status, 401, 'old access token must stop working after revocation');
    });

    test('invalid role values are rejected with 400', async () => {
        const res = await request(app)
            .put(`/api/admin/users/${regularUser.id}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'superuser' });
        assert.equal(res.status, 400);
    });

    test('agents can refer an unassigned user exactly once', async () => {
        const fresh = await seedUser({ email: 'prospect@performic.test', fullName: 'Prospect' });

        const first = await request(app)
            .post('/api/agent/refer-user')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ user_id: fresh.id });
        assert.equal(first.status, 200);

        const second = await request(app)
            .post('/api/agent/refer-user')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ user_id: fresh.id });        assert.equal(second.status, 409);
    });

    test('agents can search by name plus contact, the shape the referral UI sends', async () => {
        const prospect = await seedUser({ email: 'findme@performic.test', fullName: 'Findable Prospect' });

        const byEmail = await request(app)
            .get('/api/agent/search-user')
            .query({ name: 'findable', contact: 'findme@performic.test' })
            .set('Authorization', `Bearer ${agentToken}`);
        assert.equal(byEmail.status, 200);
        assert.ok(Array.isArray(byEmail.body));
        assert.ok(byEmail.body.some((row) => row.id === prospect.id));

        const byPhone = await request(app)
            .get('/api/agent/search-user')
            .query({ name: 'Findable', contact: '9876543210' })
            .set('Authorization', `Bearer ${agentToken}`);
        assert.equal(byPhone.status, 200);
        assert.ok(byPhone.body.some((row) => row.id === prospect.id));

        const tooShort = await request(app)
            .get('/api/agent/search-user')
            .query({ name: 'f', contact: 'findme@performic.test' })
            .set('Authorization', `Bearer ${agentToken}`);
        assert.equal(tooShort.status, 400);
    });

    test('concurrent referrals resolve to a single winner', async () => {
        const target = await seedUser({ email: 'race@performic.test', fullName: 'Race Target' });
        const otherAgent = await seedUser({ email: 'agent2@performic.test', role: 'agent', fullName: 'Agent Two' });
        const otherToken = await login('agent2@performic.test');

        const results = await Promise.all([
            request(app).post('/api/agent/refer-user').set('Authorization', `Bearer ${agentToken}`).send({ user_id: target.id }),
            request(app).post('/api/agent/refer-user').set('Authorization', `Bearer ${otherToken}`).send({ user_id: target.id }),
        ]);

        const successes = results.filter((r) => r.status === 200);
        assert.equal(successes.length, 1, `expected exactly one winner, got ${JSON.stringify(results.map((r) => r.status))}`);

        const row = await pool.query('SELECT referred_by FROM users WHERE id = $1', [target.id]);
        assert.ok(row.rows[0].referred_by);
        void otherAgent;
    });

    test('agents cannot refer themselves or non-user accounts', async () => {
        const self = await request(app)
            .post('/api/agent/refer-user')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ user_id: agent.id });
        assert.equal(self.status, 400);

        const adminTarget = await request(app)
            .post('/api/agent/refer-user')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ userId: admin.id });
        assert.equal(adminTarget.status, 400);
    });

    test('non-agents cannot use agent routes', async () => {
        const res = await request(app)
            .get('/api/agent/my-referrals')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 403);
    });

    test('referral status follows the transition graph', async () => {
        const referred = await seedUser({
            email: 'referred@performic.test',
            referredBy: agent.id,
            referralStatus: 'Not Referred',
        });

        const invalid = await request(app)
            .put(`/api/admin/referrals/${referred.id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Converted' });
        assert.equal(invalid.status, 409);

        const toReferred = await request(app)
            .put(`/api/admin/referrals/${referred.id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Referred' });
        assert.equal(toReferred.status, 200);
        assert.equal(toReferred.body.referral_status, 'Referred');

        const toConverted = await request(app)
            .put(`/api/admin/referrals/${referred.id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Converted' });
        assert.equal(toConverted.status, 200);

        const terminal = await request(app)
            .put(`/api/admin/referrals/${referred.id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Referred' });
        assert.equal(terminal.status, 409);
    });

    test('referral status cannot be set for a user without a referral', async () => {
        const orphan = await seedUser({ email: 'orphan@performic.test' });
        const res = await request(app)
            .put(`/api/admin/referrals/${orphan.id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Referred' });
        assert.equal(res.status, 422);
    });

    test('unknown referral id returns 404', async () => {
        const res = await request(app)
            .put('/api/admin/referrals/999999/status')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Referred' });
        assert.equal(res.status, 404);
    });

    test('dashboard stats are returned as numbers', async () => {
        const res = await request(app)
            .get('/api/admin/dashboard-stats')
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 200);
        assert.equal(typeof res.body.totalUsers, 'number');
        assert.ok(res.body.totalUsers >= 5);
    });
});
