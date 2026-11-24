import pool from '../config/db.mjs';
import { config, isTest } from '../config/env.mjs';
import { log } from '../middleware/requestContext.mjs';
import { pruneExpiredSessions, pruneExpiredOauthCodes } from '../utils/sessionStore.mjs';

/**
 * Periodic maintenance: expiry pruning, stale appointment progression and a heartbeat.
 * Every run is serialized across processes with an advisory lock so horizontal
 * scaling cannot double-apply the transitions.
 */
class SchedulerService {
    constructor(intervalMs = config.SCHEDULER_INTERVAL_MINUTES * 60 * 1000) {
        this.intervalMs = intervalMs;
        this.timer = null;
        this.warmupTimer = null;
        this.running = false;
        this.lastRunAt = null;
        this.lastError = null;
    }

    start() {
        if (this.timer || isTest) return;
        log('info', '[scheduler] started', { intervalMs: this.intervalMs });
        this.warmupTimer = setTimeout(() => {
            this.warmupTimer = null;
            void this.run();
        }, 5000);
        this.timer = setInterval(() => void this.run(), this.intervalMs);
        this.timer.unref?.();
    }

    stop() {
        if (this.warmupTimer) {
            clearTimeout(this.warmupTimer);
            this.warmupTimer = null;
        }
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        log('info', '[scheduler] stopped');
    }

    async run() {
        if (this.running) return;
        this.running = true;
        try {
            const lock = await pool.query("SELECT pg_try_advisory_lock(hashtextextended('performic:scheduler', 0)) AS acquired");
            if (!lock.rows[0]?.acquired) return;

            try {
                const results = await Promise.all([
                    this.pruneExpired(),
                    this.progressStaleAppointments(),
                    this.revokeAbandonedSessions(),
                    this.recordHeartbeat(),
                ]);
                this.lastRunAt = new Date().toISOString();
                this.lastError = null;
                log('info', '[scheduler] run complete', results.reduce((acc, r) => ({ ...acc, ...r }), {}));
            } finally {
                await pool.query("SELECT pg_advisory_unlock(hashtextextended('performic:scheduler', 0))").catch(() => {});
            }
        } catch (err) {
            this.lastError = err.message;
            log('error', '[scheduler] run failed', { error: err.message });
        } finally {
            this.running = false;
        }
    }

    async pruneExpired() {
        const [sessions, codes] = await Promise.all([pruneExpiredSessions(), pruneExpiredOauthCodes()]);
        return { expiredSessionsPruned: sessions, expiredOauthCodesPruned: codes };
    }

    /** Booked slots more than 24h in the past become "No Show" unless a human moved them on. */
    async progressStaleAppointments() {
        const result = await pool.query(`
            WITH stale AS (
                UPDATE appointments
                SET status = 'No Show'
                WHERE status = 'Booked' AND appointment_date < now() - interval '24 hours'
                RETURNING id, status
            )
            INSERT INTO appointment_status_history (appointment_id, from_status, to_status, changed_by, note)
            SELECT id, 'Booked', 'No Show', NULL, 'Auto-progressed by scheduler: slot passed without contact'
            FROM stale
            RETURNING (SELECT count(*)::int FROM stale) AS progressed
        `);
        return { staleAppointmentsProgressed: result.rows[0]?.progressed ?? 0 };
    }

    /** Sessions untouched for twice their lifetime are dead weight; revoke them explicitly. */
    async revokeAbandonedSessions() {
        const result = await pool.query(`
            UPDATE sessions
            SET revoked_at = now(), revoked_reason = 'abandoned'
            WHERE revoked_at IS NULL
              AND last_used_at < now() - make_interval(days => $1)
            RETURNING id`,
            [config.REFRESH_TOKEN_TTL_DAYS * 2]
        );
        return { abandonedSessionsRevoked: result.rowCount };
    }

    async recordHeartbeat() {
        const [users, applications, appointments] = await Promise.all([
            pool.query('SELECT count(*)::int AS count FROM users'),
            pool.query('SELECT count(*)::int AS count FROM applications'),
            pool.query('SELECT count(*)::int AS count FROM appointments'),
        ]);
        return {
            totalUsers: users.rows[0].count,
            totalApplications: applications.rows[0].count,
            totalAppointments: appointments.rows[0].count,
        };
    }

    status() {
        return { running: Boolean(this.timer), lastRunAt: this.lastRunAt, lastError: this.lastError };
    }
}

const scheduler = new SchedulerService();
export default scheduler;
