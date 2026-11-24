import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../app.mjs';
import { resetDatabase, teardown, TEST_PASSWORD } from './helpers.mjs';

const jar = (res) => (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');

const register = (payload) => request(app).post('/api/auth/register').send(payload);
const login = (payload) => request(app).post('/api/auth/login').send(payload);

describe('authentication', () => {
    before(async () => {
        await resetDatabase();
    });
    after(teardown);

    test('registers a user, hashes the password and never leaks it', async () => {
        const res = await register({ fullName: 'Asha Rao', email: 'Asha@Example.com', password: TEST_PASSWORD });
        assert.equal(res.status, 201);
        assert.equal(res.body.user.email, 'asha@example.com');
        assert.equal(res.body.user.password_hash, undefined);
        assert.equal(res.body.user.refresh_token, undefined);
        assert.ok(res.body.accessToken);
        assert.match(jar(res), /refreshToken=/);
    });

    test('rejects duplicate registration with 409', async () => {
        const res = await register({ fullName: 'Asha Rao', email: 'asha@example.com', password: TEST_PASSWORD });
        assert.equal(res.status, 409);
    });

    test('rejects weak passwords and malformed emails with 400', async () => {
        const weak = await register({ fullName: 'Bad Pass', email: 'bad@example.com', password: 'short' });
        assert.equal(weak.status, 400);
        assert.ok(Array.isArray(weak.body.details));

        const badEmail = await register({ fullName: 'Bad Email', email: 'not-an-email', password: TEST_PASSWORD });
        assert.equal(badEmail.status, 400);
    });

    test('logs in with case-insensitive email and rejects wrong password with 401', async () => {
        const ok = await login({ email: 'ASHA@example.com', password: TEST_PASSWORD });
        assert.equal(ok.status, 200);
        assert.ok(ok.body.accessToken);

        const bad = await login({ email: 'asha@example.com', password: 'WrongPassword1!' });
        assert.equal(bad.status, 401);
        assert.equal(bad.body.message, 'Invalid email or password');
    });

    test('rotates the refresh token and invalidates the previous one', async () => {
        const first = await login({ email: 'asha@example.com', password: TEST_PASSWORD });
        const firstJar = jar(first);

        const rotated = await request(app).post('/api/auth/refresh').set('Cookie', firstJar).send({});
        assert.equal(rotated.status, 200);
        assert.ok(rotated.body.accessToken);
        const secondJar = jar(rotated);
        assert.notEqual(secondJar, firstJar);

        // Replaying the consumed token must fail and revoke the whole family.
        const reuse = await request(app).post('/api/auth/refresh').set('Cookie', firstJar).send({});
        assert.equal(reuse.status, 401);

        const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', secondJar).send({});
        assert.equal(afterReuse.status, 401, 'family must be revoked after reuse detection');
    });

    test('refresh without a cookie is rejected', async () => {
        const res = await request(app).post('/api/auth/refresh').send({});
        assert.equal(res.status, 401);
    });

    test('protected route requires a bearer token and rejects garbage', async () => {
        const missing = await request(app).get('/api/users/me');
        assert.equal(missing.status, 401);

        const garbage = await request(app).get('/api/users/me').set('Authorization', 'Bearer not-a-jwt');
        assert.equal(garbage.status, 401);
    });

    test('/users/me returns the caller plus profile completion', async () => {
        const loggedIn = await login({ email: 'asha@example.com', password: TEST_PASSWORD });
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${loggedIn.body.accessToken}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.email, 'asha@example.com');
        assert.ok(typeof res.body.profile_completion === 'number');
    });

    test('logout revokes the session so the refresh token stops working', async () => {
        const loggedIn = await login({ email: 'asha@example.com', password: TEST_PASSWORD });
        const cookie = jar(loggedIn);

        const out = await request(app).post('/api/auth/logout').set('Cookie', cookie).send({});
        assert.equal(out.status, 200);

        const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie).send({});
        assert.equal(refresh.status, 401);
    });

    test('oauth exchange rejects an unknown or replayed code', async () => {
        const res = await request(app).post('/api/auth/oauth/exchange').send({ code: 'a'.repeat(40) });
        assert.equal(res.status, 401);
    });

    test('unknown routes return a JSON 404 with a request id', async () => {
        const res = await request(app).get('/api/does-not-exist');
        assert.equal(res.status, 404);
        assert.ok(res.body.requestId);
    });

    test('security headers are present', async () => {
        const res = await request(app).get('/health');
        assert.equal(res.status, 200);
        assert.equal(res.headers['x-powered-by'], undefined);
        assert.ok(res.headers['content-security-policy']);
        assert.ok(res.headers['x-content-type-options']);
    });
});
