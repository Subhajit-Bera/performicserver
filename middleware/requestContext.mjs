import { randomUUID } from 'node:crypto';
import { config } from '../config/env.mjs';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const threshold = LEVELS[config.LOG_LEVEL] ?? LEVELS.info;

export const log = (level, message, meta) => {
    if ((LEVELS[level] ?? LEVELS.info) < threshold) return;
    const line = meta
        ? `${new Date().toISOString()} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}`
        : `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
};

export const requestContext = (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && incoming.length <= 128 ? incoming : randomUUID();
    res.setHeader('x-request-id', req.id);
    req.startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        if (config.LOG_LEVEL === 'silent') return;
        const durationMs = Number(process.hrtime.bigint() - req.startedAt) / 1e6;
        log(res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', 'request', {
            requestId: req.id,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            userId: req.user?.id ?? null,
        });
    });

    next();
};

export default requestContext;
