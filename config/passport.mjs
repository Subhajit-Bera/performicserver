import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from './db.mjs';

const initializePassport = (passport) => {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
        const { id, displayName, emails } = profile;
        const email = emails[0].value;
        try {
            let userResult = await pool.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [id, email]);
            let user = userResult.rows[0];
            if (!user) {
                const newUserResult = await pool.query(
                    'INSERT INTO users (google_id, email, full_name, role) VALUES ($1, $2, $3, $4) RETURNING *',
                    [id, email, displayName, 'user']
                );
                user = newUserResult.rows[0];
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
};

export default initializePassport;