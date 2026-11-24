-- 0004: guarantee created_at on every entity table.
-- The baseline schema only defined created_at on some tables, which made
-- "ORDER BY created_at" and admin audit columns fail on courses/exams/partners.
DO $$
DECLARE
    target TEXT;
BEGIN
    FOREACH target IN ARRAY ARRAY[
        'courses', 'exams', 'partners', 'streams',
        'universities', 'users', 'applications', 'appointments',
        'university_streams', 'top_university_streams', 'stream_courses'
    ]
    LOOP
        IF to_regclass('public.' || target) IS NULL THEN
            CONTINUE;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = target AND column_name = 'created_at'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now()',
                target
            );
        END IF;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses (created_at);
CREATE INDEX IF NOT EXISTS idx_exams_created_at ON exams (created_at);
