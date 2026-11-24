import crypto from 'node:crypto';
import { Router } from 'express';
import passport from 'passport';
import { timingSafeEqual } from 'node:crypto';
import {
    registerUser,
    loginUser,
    refreshToken,
    logoutUser,
    handleGoogleCallback,
    exchangeOauthCode,
} from '../controllers/authController.mjs';
import { validate } from '../utils/validate.mjs';
import {
    registerSchema,
    loginSchema,
    oauthExchangeSchema,
} from '../schemas/authSchemas.mjs';
import { authLimiter } from '../middleware/rateLimiters.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import {
    issueOauthStateCookie,
    clearOauthStateCookie,
    OAUTH_STATE_COOKIE_NAME,
} from '../utils/tokenUtils.mjs';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), registerUser);
router.post('/login', authLimiter, validate({ body: loginSchema }), loginUser);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);
router.post('/oauth/exchange', validate({ body: oauthExchangeSchema }), exchangeOauthCode);

const safeEqual = (a, b) => {
    const left = Buffer.from(String(a ?? ''));
    const right = Buffer.from(String(b ?? ''));
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
};

// Issues an anti-CSRF state value and stores it in a short-lived HttpOnly cookie.
const beginGoogleAuth = asyncHandler(async (req, res, next) => {
    const state = crypto.randomBytes(24).toString('base64url');
    issueOauthStateCookie(res, state);
    return passport.authenticate('google', { scope: ['profile', 'email'], state, session: false })(req, res, next);
});

const verifyGoogleState = (req, _res, next) => {
    const expected = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
    if (!expected || !safeEqual(expected, req.query?.state)) {
        return next(ApiError.badRequest('Invalid OAuth state. Please try signing in again.'));
    }
    return next();
};

router.get('/google', authLimiter, beginGoogleAuth);

router.get(
    '/google/callback',
    verifyGoogleState,
    (req, res, next) => {
        clearOauthStateCookie(res);
        passport.authenticate('google', { session: false, failWithError: true }, (err, user, info) => {
            if (err) return next(err);
            if (!user) {
                return next(ApiError.unauthorized(info?.message || 'Google authentication failed'));
            }
            req.user = user;
            return next();
        })(req, res, next);
    },
    handleGoogleCallback
);

export default router;
