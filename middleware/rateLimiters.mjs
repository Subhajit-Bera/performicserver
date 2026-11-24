import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config, isTest } from '../config/env.mjs';

// NOTE: the default in-memory store is per process. When running more than one
// API replica, supply a shared store (Redis/Postgres) via RATE_LIMIT_STORE.
const base = {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest,
};

// ipKeyGenerator normalizes IPv6 to its /56 subnet so a single client cannot
// rotate addresses to escape the limit.
const ipKey = (req) => ipKeyGenerator(req.ip ?? '');
const keyByUserOrIp = (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${ipKey(req)}`);

export const apiLimiter = rateLimit({
    ...base,
    limit: config.RATE_LIMIT_MAX,
    message: { message: 'Too many requests. Please try again later.' },
});

export const authLimiter = rateLimit({
    ...base,
    limit: config.AUTH_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `auth:${ipKey(req)}:${String(req.body?.email ?? '').toLowerCase()}`,
    message: { message: 'Too many authentication attempts. Please try again later.' },
});

export const writeLimiter = rateLimit({
    ...base,
    limit: config.WRITE_RATE_LIMIT_MAX,
    keyGenerator: keyByUserOrIp,
    message: { message: 'Too many write operations. Please slow down.' },
});

export const searchLimiter = rateLimit({
    ...base,
    limit: config.SEARCH_RATE_LIMIT_MAX,
    keyGenerator: keyByUserOrIp,
    message: { message: 'Too many search requests. Please slow down.' },
});

export const contactLimiter = rateLimit({
    ...base,
    windowMs: 60 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => `contact:${ipKey(req)}`,
    message: { message: 'Too many contact submissions. Please try again later.' },
});
