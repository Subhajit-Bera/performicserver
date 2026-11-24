import 'dotenv/config';

process.env.NODE_ENV = 'test';

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('performic_test_db')) {
    const source = new URL(process.env.DATABASE_URL);
    source.pathname = '/performic_test_db';
    process.env.DATABASE_URL = source.toString();
}

process.env.ENABLE_SCHEDULER = 'false';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';

const { runMigrations } = await import('../scripts/migrate.mjs');
await runMigrations();

process.on('exit', () => {
    try {
        // Best-effort teardown; the pool is closed explicitly in tests/helpers.mjs.
    } catch {
        /* noop */
    }
});
