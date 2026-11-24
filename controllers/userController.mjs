import pool from '../config/db.mjs';
import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sanitizeUser } from '../utils/http.mjs';
import { requireCompleteProfile, calculateProfileCompletion } from '../utils/profileCompletion.mjs';

const MAX_ACTIVE_APPOINTMENTS = 3;

const USER_COLUMNS = `id, google_id, full_name, email, role, phone_number, whatsapp_number,
    state_hometown, choice_of_stream, choice_of_stream_other, entry_level, entry_level_other,
    how_heard, how_heard_other, referred_by, referral_status, created_at, updated_at`;

const loadUser = async (userId) => {
    const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
    if (result.rows.length === 0) throw ApiError.notFound('User not found');
    return result.rows[0];
};

export const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await loadUser(req.user.id);
    return res.json({ ...sanitizeUser(user), profile_completion: calculateProfileCompletion(user) });
});

export const updateUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        fullName,
        phoneNumber,
        whatsAppNumber,
        stateHometown,
        choiceOfStream,
        choiceOfStreamOther,
        entryLevel,
        entryLevelOther,
        howHeard,
        howHeardOther,
    } = req.body;

    const result = await pool.query(
        `UPDATE users SET
            full_name = COALESCE($1, full_name),
            phone_number = COALESCE($2, phone_number),
            whatsapp_number = COALESCE($3, whatsapp_number),
            state_hometown = COALESCE($4, state_hometown),
            choice_of_stream = COALESCE($5, choice_of_stream),
            choice_of_stream_other = COALESCE($6, choice_of_stream_other),
            entry_level = COALESCE($7, entry_level),
            entry_level_other = COALESCE($8, entry_level_other),
            how_heard = COALESCE($9, how_heard),
            how_heard_other = COALESCE($10, how_heard_other)
         WHERE id = $11
         RETURNING ${USER_COLUMNS}`,
        [
            fullName ?? null,
            phoneNumber ?? null,
            whatsAppNumber ?? null,
            stateHometown ?? null,
            choiceOfStream ?? null,
            choiceOfStreamOther ?? null,
            entryLevel ?? null,
            entryLevelOther ?? null,
            howHeard ?? null,
            howHeardOther ?? null,
            userId,
        ]
    );

    const user = result.rows[0];
    if (!user) throw ApiError.notFound('User not found');

    return res.json({ ...sanitizeUser(user), profile_completion: calculateProfileCompletion(user) });
});

export const applyToUniversity = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { universityId, courseOfferingId } = req.body;

    const applicant = await loadUser(userId);
    requireCompleteProfile(applicant);

    const universityResult = await pool.query(
        'SELECT id, name, admission_open, admission_year FROM universities WHERE id = $1',
        [universityId]
    );
    const university = universityResult.rows[0];
    if (!university) throw ApiError.notFound('University not found');
    if (!university.admission_open) {
        throw ApiError.unprocessable('Admissions are currently closed for this university');
    }

    let offering = null;
    if (courseOfferingId) {
        const offeringResult = await pool.query(
            `SELECT o.id, o.course_id, c.name AS course_name
             FROM university_course_offerings o
             JOIN courses c ON c.id = o.course_id
             WHERE o.id = $1 AND o.university_id = $2`,
            [courseOfferingId, universityId]
        );
        offering = offeringResult.rows[0];
        if (!offering) {
            throw ApiError.badRequest('Selected course is not offered by this university');
        }
    }

    const inserted = await pool.query(
        `INSERT INTO applications (user_id, university_id, course_offering_id, course_name, university_name_snapshot, status)
         VALUES ($1, $2, $3, $4, $5, 'Applied')
         RETURNING id, user_id, university_id, course_offering_id, course_name, status, applied_at`,
        [userId, universityId, offering?.id ?? null, offering?.course_name ?? null, university.name]
    );

    const application = inserted.rows[0];
    await pool.query(
        `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, note)
         VALUES ($1, NULL, 'Applied', $2, 'Submitted by applicant')`,
        [application.id, userId]
    );

    return res.status(201).json(application);
});

export const getUserApplications = asyncHandler(async (req, res) => {
    const result = await pool.query(
        `SELECT app.id, app.status, app.course_name, app.applied_at,
                uni.id AS university_id, uni.name AS university_name, uni.slug AS university_slug,
                uni.location, uni.image_url
         FROM applications app
         JOIN universities uni ON app.university_id = uni.id
         WHERE app.user_id = $1
         ORDER BY app.applied_at DESC, app.id DESC
         LIMIT 200`,
        [req.user.id]
    );
    return res.json(result.rows);
});

export const bookAppointment = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { date, notes } = req.body;

    const applicant = await loadUser(userId);
    requireCompleteProfile(applicant);

    const active = await pool.query(
        `SELECT count(*)::int AS count FROM appointments WHERE user_id = $1 AND status = 'Booked'`,
        [userId]
    );
    if (active.rows[0].count >= MAX_ACTIVE_APPOINTMENTS) {
        throw ApiError.conflict(
            `You already have ${MAX_ACTIVE_APPOINTMENTS} upcoming appointments. Cancel one before booking again.`
        );
    }

    const inserted = await pool.query(
        `INSERT INTO appointments (user_id, appointment_date, notes, status)
         VALUES ($1, $2, $3, 'Booked')
         RETURNING id, user_id, appointment_date, notes, status, created_at`,
        [userId, date.toISOString(), notes ?? null]
    );

    const appointment = inserted.rows[0];
    await pool.query(
        `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, changed_by, note)
         VALUES ($1, NULL, 'Booked', $2, 'Booked by applicant')`,
        [appointment.id, userId]
    );

    return res.status(201).json(appointment);
});

export const getUserAppointments = asyncHandler(async (req, res) => {
    const result = await pool.query(
        `SELECT id, appointment_date, notes, status, created_at, updated_at
         FROM appointments WHERE user_id = $1
         ORDER BY appointment_date DESC, id DESC
         LIMIT 200`,
        [req.user.id]
    );
    return res.json(result.rows);
});

export const cancelAppointment = asyncHandler(async (req, res) => {
    const appointmentId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
        throw ApiError.badRequest('Appointment id must be a positive integer');
    }

    const result = await pool.query(
        `UPDATE appointments SET status = 'Cancelled'
         WHERE id = $1 AND user_id = $2 AND status = 'Booked'
         RETURNING id, appointment_date, notes, status`,
        [appointmentId, req.user.id]
    );

    const appointment = result.rows[0];
    if (!appointment) throw ApiError.notFound('Appointment not found or already processed');

    await pool.query(
        `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, changed_by, note)
         VALUES ($1, 'Booked', 'Cancelled', $2, 'Cancelled by applicant')`,
        [appointment.id, req.user.id]
    );

    return res.json(appointment);
});
