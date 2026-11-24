import app from './app.mjs';
import { config, isProduction } from './config/env.mjs';
import pool, { closePool } from './config/db.mjs';
import { log } from './middleware/requestContext.mjs';
import scheduler from './services/schedulerService.mjs';
import { pendingMigrations } from './scripts/migrate.mjs';

const databaseName = () => {
    try {
        return new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '');
    } catch {
        return 'unknown';
    }
};

let server;
let shuttingDown = false;

const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', `[server] ${signal} received, shutting down`);

    scheduler.stop();

    if (server) {
        const closeServer = new Promise((resolve) => server.close(resolve));
        const timeout = new Promise((resolve) => setTimeout(resolve, 10000));
        await Promise.race([closeServer, timeout]);
    }

    try {
        await closePool();
    } catch (err) {
        log('error', '[server] failed to close database pool', { error: err.message });
    }

    process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    log('error', '[server] unhandled rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
});

process.on('uncaughtException', (err) => {
    log('error', '[server] uncaught exception', { error: err.message, stack: err.stack });
    if (isProduction) void shutdown('uncaughtException');
});

// Fail fast instead of serving traffic with a broken database connection.
pool.on('error', (err) => {
    log('error', '[db] idle client error', { error: err.message });
});

const boot = async () => {
    let pending;
    try {
        pending = await pendingMigrations();
    } catch (err) {
        log('error', '[boot] cannot reach the database', { database: databaseName(), error: err.message });
        process.exit(1);
    }

    if (pending.length > 0) {
        log('error', '[boot] database schema is out of date, refusing to serve traffic', {
            database: databaseName(),
            pendingMigrations: pending.map((migration) => migration.version),
            fix: 'run `npm run migrate` against this database, then start the server again',
        });
        await closePool().catch(() => {});
        process.exit(1);
    }

    server = app.listen(config.PORT, () => {
        log('info', `PerFormic API listening on port ${config.PORT}`, { env: config.NODE_ENV, database: databaseName() });
        if (config.ENABLE_SCHEDULER) scheduler.start();
    });

    server.headersTimeout = config.REQUEST_TIMEOUT_MS + 5000;
    server.requestTimeout = config.REQUEST_TIMEOUT_MS;
    server.keepAliveTimeout = 65000;
};

void boot();
