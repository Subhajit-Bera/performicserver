import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool, { closePool } from '../config/db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const ensureRegistry = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     TEXT PRIMARY KEY,
            filename    TEXT NOT NULL,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
};

const appliedVersions = async (client) => {
    const result = await client.query('SELECT version FROM schema_migrations');
    return new Set(result.rows.map((row) => row.version));
};

const readMigrations = async () => {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    return entries
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => ({ version: name.replace(/\.sql$/, ''), filename: name }));
};

export const runMigrations = async () => {
    const client = await pool.connect();
    const applied = [];
    try {
        await ensureRegistry(client);
        const done = await appliedVersions(client);
        const migrations = await readMigrations();

        for (const migration of migrations) {
            if (done.has(migration.version)) continue;

            const sql = await fs.readFile(path.join(MIGRATIONS_DIR, migration.filename), 'utf8');
            const startedAt = Date.now();
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
                    [migration.version, migration.filename]
                );
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                err.migration = migration.version;
                throw err;
            }
            applied.push({ ...migration, durationMs: Date.now() - startedAt });
            console.log(`[migrate] applied ${migration.version} (${Date.now() - startedAt}ms)`);
        }
        return applied;
    } finally {
        client.release();
    }
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.join(__dirname, 'migrate.mjs');

if (isDirectRun) {
    runMigrations()
        .then(async (appliedList) => {
            console.log(
                appliedList.length
                    ? `[migrate] completed ${appliedList.length} migration(s)`
                    : '[migrate] database already up to date'
            );
            await closePool();
        })
        .catch(async (err) => {
            console.error(`[migrate] failed on ${err.migration || 'registry'}: ${err.message}`);
            if (err.detail) console.error(`[migrate] detail: ${err.detail}`);
            if (err.hint) console.error(`[migrate] hint: ${err.hint}`);
            await closePool().catch(() => {});
            process.exitCode = 1;
        });
}
