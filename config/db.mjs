import fs from 'node:fs';
import pg from 'pg';
import { config, isProduction } from './env.mjs';

const { Pool } = pg;

// Production connections must verify the server certificate. Supply DB_SSL_CA_FILE
// when the provider uses a private CA; otherwise the system trust store is used.
const buildSslOptions = () => {
    if (!isProduction) return false;
    if (config.DB_SSL_CA_FILE) {
        return { rejectUnauthorized: true, ca: fs.readFileSync(config.DB_SSL_CA_FILE) };
    }
    return { rejectUnauthorized: true };
};

const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: config.DB_POOL_MAX,
    idleTimeoutMillis: config.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT_MS,
    ssl: buildSslOptions(),
});

pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle PostgreSQL client:', err.message);
});

export const withTransaction = async (work) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('[db] Rollback failed:', rollbackErr.message);
        }
        throw err;
    } finally {
        client.release();
    }
};

export const closePool = async () => {
    await pool.end();
};

export default pool;
