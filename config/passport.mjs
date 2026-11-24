import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { withTransaction } from './db.mjs';

const USER_COLUMNS = `id, google_id, full_name, email, role, phone_number, whatsapp_number,
    state_hometown, choice_of_stream, choice_of_stream_other, entry_level, entry_level_other,
    how_heard, how_heard_other, referred_by, referral_status, created_at, updated_at`;

const initializePassport = (passport) => {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
            },
            async (_accessToken, _refreshToken, profile, done) => {
                try {
                    const email = profile?.emails?.[0]?.value;

                    if (!email) return done(null, false, { message: 'Google account has no email address' });
                    // Reject unverified addresses so an attacker cannot claim an
                    // existing account by registering an unverified Google email.
                    if (profile.emails[0].verified === false) {
                        return done(null, false, { message: 'Google email address is not verified' });
                    }

                    const normalizedEmail = email.trim().toLowerCase();
                    const googleId = String(profile.id);
                    const displayName = (profile.displayName || normalizedEmail).slice(0, 100);

                    // Advisory lock on the email serializes concurrent first-time logins.
                    const user = await withTransaction(async (client) => {
                        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
                            `oauth:${normalizedEmail}`,
                        ]);

                        const byGoogleId = await client.query(
                            `SELECT ${USER_COLUMNS} FROM users WHERE google_id = $1`,
                            [googleId]
                        );
                        if (byGoogleId.rows[0]) return byGoogleId.rows[0];

                        const inserted = await client.query(
                            `INSERT INTO users (google_id, email, full_name, role)
                             VALUES ($1, $2, $3, 'user')
                             ON CONFLICT (email) DO UPDATE
                                SET google_id = EXCLUDED.google_id, updated_at = now()
                              WHERE users.google_id IS NULL
                             RETURNING ${USER_COLUMNS}`,
                            [googleId, normalizedEmail, displayName]
                        );

                        if (inserted.rows[0]) return inserted.rows[0];

                        throw Object.assign(
                            new Error('This email is already linked to a different Google account'),
                            { authFailure: true }
                        );
                    });

                    return done(null, user);
                } catch (err) {
                    if (err?.authFailure) return done(null, false, { message: err.message });
                    return done(err);
                }
            }
        )
    );
};

export default initializePassport;
