-- Content raw source text.
-- Uploads keep the original text so content can be (re)processed for AI
-- simplification/quiz generation at any time, independent of the stored
-- adapted JSON in simplified_text.
ALTER TABLE content ADD COLUMN raw_text TEXT;
