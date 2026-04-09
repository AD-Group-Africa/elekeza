-- Reconcile legacy lesson_sections ordering column names across environments.
-- Canonical column is sequence_number.

DO $$
BEGIN
    -- Legacy schema (V1) used section_order only.
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lesson_sections'
          AND column_name = 'section_order'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lesson_sections'
          AND column_name = 'sequence_number'
    ) THEN
        ALTER TABLE lesson_sections RENAME COLUMN section_order TO sequence_number;
    END IF;

    -- Drifted schema may contain both columns; keep sequence_number and remove section_order.
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lesson_sections'
          AND column_name = 'section_order'
    )
    AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lesson_sections'
          AND column_name = 'sequence_number'
    ) THEN
        UPDATE lesson_sections
        SET sequence_number = COALESCE(sequence_number, section_order)
        WHERE sequence_number IS NULL;

        ALTER TABLE lesson_sections
            ALTER COLUMN sequence_number SET NOT NULL;

        ALTER TABLE lesson_sections
            DROP COLUMN section_order;
    END IF;
END $$;

