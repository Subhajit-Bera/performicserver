import bcrypt from 'bcryptjs';
import pool, { withTransaction } from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
    sendAuthTokens,
    startOauthHandoff,
    clearRefreshCookie,
    setRefreshCookie,
    generateAccessToken,
    REFRESH_COOKIE_NAME,
} from '../utils/tokenUtils.mjs';
import {
    rotateSession,
    revokeSession,
    hashToken,
    consumeOauthCode,
} from '../utils/sessionStore.mjs';
import { sanitizeUser } from '../utils/http.mjs';

// Constant-cost comparison for accounts that do not exist, which keeps login
// timing from revealing whether an email is registered.
const DUMMY_HASH = bcrypt.hashSync('performic-timing-equalizer', 10);

const USER_COLUMNS = `id, google_id, full_name, email, role, phone_number, whatsapp_number,
    state_hometown, choice_of_stream, choice_of_stream_other, entry_level, entry_level_other,
    how_heard, how_heard_other, referred_by, referral_status, created_at, updated_at`;

export const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await withTransaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`register:${email}`]);

        const existing = await client.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
        if (existing.rows.length > 0) {
            throw ApiError.conflict('An account with this email already exists');
        }

        const inserted = await client.query(
            `INSERT INTO users (full_name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING ${USER_COLUMNS}`,
            [fullName, email, hashedPassword]
        );
        return inserted.rows[0];
    });

    return sendAuthTokens(req, res, user, 201);
});

export const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await pool.query(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE lower(email) = $1`, [email]);
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !user.password_hash || !isMatch) {
        throw ApiError.unauthorized('Invalid email or password');
    }

    return sendAuthTokens(req, res, sanitizeUser({ ...user, password_hash: undefined }));
});

export const refreshToken = asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!presented) throw ApiError.unauthorized('No refresh token provided');

    const rotated = await rotateSession(presented, {
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
    });

    setRefreshCookie(res, rotated.rawToken);

    return res.status(200).json({
        accessToken: generateAccessToken(rotated.user, rotated.session.id),
        user: sanitizeUser(rotated.user),
    });
});

export const logoutUser = asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME];
    if (presented) {
        const result = await pool.query('SELECT id FROM sessions WHERE token_hash = $1', [hashToken(presented)]);
        if (result.rows[0]) await revokeSession(result.rows[0].id, 'logout');
    }
    clearRefreshCookie(res);
    return res.status(200).json({ message: 'Logged out successfully' });
});

export const handleGoogleCallback = asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized('Google authentication failed');
    return startOauthHandoff(req, res, req.user);
});

/** Trades the single-use OAuth code for an access token. */
export const exchangeOauthCode = asyncHandler(async (req, res) => {
    const { code } = req.body;
    const consumed = await consumeOauthCode(code);
    if (!consumed) throw ApiError.unauthorized('Authorization code is invalid or already used');

    const result = await pool.query(
        `SELECT s.id AS session_id, s.expires_at, u.*
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now()`,
        [consumed.session_id, consumed.user_id]
    );

    const row = result.rows[0];
    if (!row) throw ApiError.unauthorized('Session is no longer valid. Please sign in again.');

    return res.status(200).json({
        accessToken: generateAccessToken(row, row.session_id),
        user: sanitizeUser(row),
    });
});
