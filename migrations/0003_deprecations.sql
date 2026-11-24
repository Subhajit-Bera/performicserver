-- 0003_deprecations.sql
-- Removes structures that the redesigned application no longer uses.
--
-- IMPORTANT: dropping users.refresh_token invalidates every existing refresh
-- cookie, so all users must sign in again after this release. That is expected
-- for the session-store migration and is why it is isolated in its own file.

DROP INDEX IF EXISTS idx_users_refresh_token;
ALTER TABLE users DROP COLUMN IF EXISTS refresh_token;

-- Replaced by university_course_offerings (foreign-key based matching).
ALTER TABLE courses DROP COLUMN IF EXISTS related_university_ids;

-- Redundant: the leftmost prefix of applications_user_id_university_id_key
-- already serves user_id lookups.
DROP INDEX IF EXISTS idx_applications_user_id;

-- No active query uses containment on exams.info; the GIN index only added
-- write overhead.
DROP INDEX IF EXISTS idx_exams_info;
