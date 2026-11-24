import 'dotenv/config';
import { z } from 'zod';

const secret = (name) =>
    z
        .string({ message: `${name} is required` })
        .min(1, `${name} is required`)
        .refine((value) => value.length >= 32, {
            message: `${name} should be at least 32 characters; rotate it before production use`,
        });

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DB_SSL_CA_FILE: z.string().min(1).optional(),
    DB_POOL_MAX: z.coerce.number().int().positive().max(200).default(20),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
    ACCESS_TOKEN_TTL: z.string().min(2).default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(90).default(7),

    CLIENT_URL: z.string().min(1, 'CLIENT_URL is required'),
    SERVER_URL: z.string().min(1, 'SERVER_URL is required'),

    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    OAUTH_CODE_TTL_SECONDS: z.coerce.number().int().positive().max(600).default(120),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    WRITE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    SEARCH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

    REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
    SCHEDULER_INTERVAL_MINUTES: z.coerce.number().int().positive().default(10),
    ENABLE_SCHEDULER: z
        .enum(['true', 'false', '1', '0'])
        .default('true')
        .transform((value) => value === 'true' || value === '1'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    const details = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
    console.error('[config] Invalid or missing environment configuration:\n' + details);
    process.exit(1);
}

export const config = Object.freeze(parsed.data);
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
