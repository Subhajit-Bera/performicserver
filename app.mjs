import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import passport from 'passport';

import { config, isProduction } from './config/env.mjs';
import initializePassport from './config/passport.mjs';
import { requestContext } from './middleware/requestContext.mjs';
import { apiLimiter } from './middleware/rateLimiters.mjs';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.mjs';

import authRoutes from './routes/authRoutes.mjs';
import userRoutes from './routes/userRoutes.mjs';
import universityRoutes from './routes/universityRoutes.mjs';
import examRoutes from './routes/examRoutes.mjs';
import courseRoutes from './routes/courseRoutes.mjs';
import streamRoutes from './routes/streamRoutes.mjs';
import partnerRoutes from './routes/partnerRoutes.mjs';
import contactRoutes from './routes/contactRoutes.mjs';
import agentRoutes from './routes/agentRoutes.mjs';
import adminRoutes from './routes/adminRoutes.mjs';

const allowedOrigins = config.CLIENT_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY_HOPS > 0 ? config.TRUST_PROXY_HOPS : false);
app.set('etag', 'strong');

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", ...allowedOrigins],
                frameAncestors: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: isProduction ? [] : null,
            },
        },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
);

app.use(
    cors({
        origin(origin, callback) {
            // Same-origin/server-to-server requests have no Origin header.
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error(`Origin ${origin} is not allowed by CORS`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposedHeaders: ['X-Request-Id'],
        maxAge: 600,
    })
);

app.use(requestContext);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());
initializePassport(passport);

app.use('/api', apiLimiter);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), env: config.NODE_ENV });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
