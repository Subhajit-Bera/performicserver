import jwt from 'jsonwebtoken';
import { withTransaction } from '../config/db.mjs';
import { config, isProduction } from '../config/env.mjs';
import { sanitizeUser } from './http.mjs';
import { createSession, createOauthCode } from './sessionStore.mjs';

export const ACCESS_TOKEN_ISSUER = 'performic-api';
export const ACCESS_TOKEN_AUDIENCE = 'performic-web';
export const REFRESH_COOKIE_NAME = 'refreshToken';
export const OAUTH_STATE_COOKIE_NAME = 'oauthState';

export const generateAccessToken = (user, sessionId) =>
    jwt.sign({ sub: String(user.id), sid: sessionId, role: user.role }, config.JWT_ACCESS_SECRET, {
        algorithm: 'HS256',
        expiresIn: config.ACCESS_TOKEN_TTL,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
    });

export const verifyAccessToken = (token) =>
    jwt.verify(token, config.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
    });

export const refreshCookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

export const setRefreshCookie = (res, rawToken) => {
    res.cookie(REFRESH_COOKIE_NAME, rawToken, refreshCookieOptions());
};

export const clearRefreshCookie = (res) => {
    res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
};

const requestMeta = (req) => ({
    userAgent: req?.get?.('user-agent') ?? null,
    ipAddress: req?.ip ?? null,
});

/** Creates a refresh session and returns the JSON body the SPA expects. */
export const sendAuthTokens = async (req, res, user, status = 200) => {
    const { session, rawToken } = await withTransaction((client) =>
        createSession(client, { userId: user.id, ...requestMeta(req) })
    );

    setRefreshCookie(res, rawToken);

    return res.status(status).json({
        accessToken: generateAccessToken(user, session.id),
        user: sanitizeUser(user),
    });
};

/**
 * OAuth handoff. The 302 response originates from the API, so the refresh
 * cookie is stored for the API origin even though the browser navigates to the
 * frontend. Only a single-use code appears in the URL.
 */
export const startOauthHandoff = async (req, res, user) => {
    const { rawToken, code } = await withTransaction(async (client) => {
        const created = await createSession(client, { userId: user.id, ...requestMeta(req) });
        const oneTimeCode = await createOauthCode(client, {
            sessionId: created.session.id,
            userId: user.id,
        });
        return { rawToken: created.rawToken, code: oneTimeCode };
    });

    setRefreshCookie(res, rawToken);

    const target = new URL('/auth/callback', config.CLIENT_URL);
    target.searchParams.set('code', code);
    return res.redirect(302, target.toString());
};

export const issueOauthStateCookie = (res, state) => {
    res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 10 * 60 * 1000,
    });
};

export const clearOauthStateCookie = (res) => {
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/api/auth',
    });
};
