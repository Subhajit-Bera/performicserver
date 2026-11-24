import fs from 'node:fs';
import dns from 'node:dns';
import dnsPromises from 'node:dns/promises';
import pg from 'pg';
import { config, isProduction } from './env.mjs';

// Resilient DNS fallback for cloud databases (Neon, Supabase) when local ISP DNS fails
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    const origLookup = dns.lookup;
    dns.lookup = (hostname, options, callback) => {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        origLookup(hostname, options, (err, address, family) => {
            if (!err && address) return callback(null, address, family);
            dnsPromises
                .resolve4(hostname)
                .then((ips) => {
                    if (ips && ips.length > 0) {
                        if (options && options.all) {
                            callback(null, ips.map((ip) => ({ address: ip, family: 4 })));
                        } else {
                            callback(null, ips[0], 4);
                        }
                    } else {
                        callback(err, address, family);
                    }
                })
                .catch(() => callback(err, address, family));
        });
    };
} catch {
    /* ignore if dns overriding is not permitted */
}

const { Pool } = pg;

// Production connections or remote cloud databases (Neon, Supabase, etc.) must use SSL.
// Supply DB_SSL_CA_FILE when the provider uses a private CA; otherwise system trust store is used.
const buildSslOptions = () => {
    if (process.env.DB_SSL === 'false') return false;

    const isRemote =
        config.DATABASE_URL.includes('sslmode=require') ||
        config.DATABASE_URL.includes('.neon.tech') ||
        config.DATABASE_URL.includes('.supabase.co') ||
        config.DATABASE_URL.includes('.render.com') ||
        (!config.DATABASE_URL.includes('localhost') && !config.DATABASE_URL.includes('127.0.0.1'));

    if (!isProduction && !isRemote && process.env.DB_SSL !== 'true') {
        return false;
    }

    const rejectUnauthorized = config.DB_SSL_REJECT_UNAUTHORIZED ?? false;
    if (config.DB_SSL_CA_FILE) {
        return { rejectUnauthorized, ca: fs.readFileSync(config.DB_SSL_CA_FILE) };
    }
    return { rejectUnauthorized };
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
