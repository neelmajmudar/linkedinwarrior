-- Add unipile_draft_id to track Gmail drafts created via Unipile
ALTER TABLE email_drafts
  ADD COLUMN IF NOT EXISTS unipile_draft_id TEXT;

CREATE INDEX IF NOT EXISTS idx_email_drafts_unipile_draft_id
  ON email_drafts(unipile_draft_id);
