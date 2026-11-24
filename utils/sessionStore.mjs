import crypto from 'node:crypto';
import pool, { withTransaction } from '../config/db.mjs';
import { config } from '../config/env.mjs';
import { ApiError } from './ApiError.mjs';

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const generateOpaqueToken = () => crypto.randomBytes(48).toString('base64url');

const sessionExpiry = () => new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

const truncate = (value, max) => (typeof value === 'string' && value.length > max ? value.slice(0, max) : value);

export const createSession = async (client, { userId, userAgent, ipAddress, familyId, parentId = null }) => {
    const rawToken = generateOpaqueToken();
    const result = await client.query(
        `INSERT INTO sessions (user_id, token_hash, family_id, parent_id, user_agent, ip_address, expires_at)
         VALUES ($1, $2, COALESCE($3, gen_random_uuid()), $4, $5, $6, $7)
         RETURNING id, user_id, family_id, expires_at`,
        [
            userId,
            hashToken(rawToken),
            familyId ?? null,
            parentId,
            truncate(userAgent ?? null, 300),
            ipAddress ?? null,
            sessionExpiry(),
        ]
    );
    return { session: result.rows[0], rawToken };
};

export const revokeFamily = async (client, familyId, reason) => {
    await client.query(
        `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
         WHERE family_id = $1 AND revoked_at IS NULL`,
        [familyId, truncate(reason, 60)]
    );
};

export const revokeSession = async (sessionId, reason) => {
    await pool.query(
        `UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE id = $1 AND revoked_at IS NULL`,
        [sessionId, truncate(reason, 60)]
    );
};

export const revokeUserSessions = async (userId, reason = 'policy') => {
    const result = await pool.query(
        `UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId, truncate(reason, 60)]
    );
    return result.rowCount;
};

export const getActiveSession = async (sessionId) => {
    const result = await pool.query(
        `SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.role, u.email, u.full_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
        [sessionId]
    );
    return result.rows[0] ?? null;
};

/**
 * Rotates a refresh token atomically.
 *
 * Reuse of an already-rotated or revoked token revokes the whole family, which
 * is the standard signal that a token was stolen and replayed.
 */
export const rotateSession = async (rawToken, { userAgent, ipAddress } = {}) => {
    const tokenHash = hashToken(rawToken);

    // Throwing inside the transaction would roll back the revocation, so the
    // transaction returns an outcome and the error is raised after COMMIT.
    const result = await withTransaction(async (client) => {
        const existing = await client.query(
            `SELECT id, user_id, family_id, revoked_at, revoked_reason, expires_at
             FROM sessions WHERE token_hash = $1 FOR UPDATE`,
            [tokenHash]
        );

        const current = existing.rows[0];
        if (!current) return { outcome: 'invalid' };

        if (current.revoked_at || current.expires_at <= new Date()) {
            await revokeFamily(client, current.family_id, 'reuse-detected');
            return { outcome: 'reuse' };
        }

        await client.query(
            `UPDATE sessions SET revoked_at = now(), revoked_reason = 'rotated', last_used_at = now() WHERE id = $1`,
            [current.id]
        );

        const created = await createSession(client, {
            userId: current.user_id,
            userAgent,
            ipAddress,
            familyId: current.family_id,
            parentId: current.id,
        });

        const user = await client.query(
            `SELECT id, full_name, email, role, google_id, phone_number, whatsapp_number, state_hometown,
                    choice_of_stream, choice_of_stream_other, entry_level, entry_level_other,
                    how_heard, how_heard_other, referred_by, referral_status, created_at
             FROM users WHERE id = $1`,
            [current.user_id]
        );

        if (user.rows.length === 0) {
            await revokeFamily(client, current.family_id, 'user-deleted');
            return { outcome: 'user-deleted' };
        }

        return { outcome: 'rotated', user: user.rows[0], ...created };
    });

    if (result.outcome === 'invalid') throw ApiError.unauthorized('Invalid refresh token');
    if (result.outcome === 'reuse') throw ApiError.unauthorized('Refresh token is no longer valid');
    if (result.outcome === 'user-deleted') throw ApiError.unauthorized('Account no longer exists');

    delete result.outcome;
    return result;
};

export const pruneExpiredSessions = async () => {
    const result = await pool.query(
        `DELETE FROM sessions WHERE expires_at < now() - INTERVAL '1 day' OR (revoked_at IS NOT NULL AND revoked_at < now() - INTERVAL '30 days')`
    );
    return result.rowCount;
};

export const createOauthCode = async (client, { sessionId, userId }) => {
    const code = crypto.randomBytes(32).toString('base64url');
    await client.query(
        `INSERT INTO oauth_codes (code, session_id, user_id, expires_at)
         VALUES ($1, $2, $3, now() + make_interval(secs => $4))`,
        [code, sessionId, userId, config.OAUTH_CODE_TTL_SECONDS]
    );
    return code;
};

/** Single-use consumption: concurrent exchanges cannot both succeed. */
export const consumeOauthCode = async (code) => {
    const result = await pool.query(
        `UPDATE oauth_codes SET consumed_at = now()
         WHERE code = $1 AND consumed_at IS NULL AND expires_at > now()
         RETURNING session_id, user_id`,
        [code]
    );
    return result.rows[0] ?? null;
};

export const pruneExpiredOauthCodes = async () => {
    const result = await pool.query(
        `DELETE FROM oauth_codes WHERE expires_at < now() - INTERVAL '1 hour' OR consumed_at IS NOT NULL`
    );
    return result.rowCount;
};
