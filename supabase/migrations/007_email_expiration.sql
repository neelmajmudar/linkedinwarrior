-- Add 48-hour expiration column to emails
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Back-fill existing rows: received_at + 48h
UPDATE emails SET expires_at = received_at + interval '48 hours'
  WHERE expires_at IS NULL;

-- Trigger: auto-set expires_at on INSERT
CREATE OR REPLACE FUNCTION set_email_expires_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.expires_at := COALESCE(NEW.received_at, now()) + interval '48 hours';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_expires_at ON emails;
CREATE TRIGGER trg_email_expires_at
  BEFORE INSERT ON emails
  FOR EACH ROW EXECUTE FUNCTION set_email_expires_at();

-- Index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_emails_expires_at ON emails (expires_at);

-- Cascade-delete drafts when an email is removed
ALTER TABLE email_drafts
  DROP CONSTRAINT IF EXISTS email_drafts_email_id_fkey;
ALTER TABLE email_drafts
  ADD CONSTRAINT email_drafts_email_id_cascade
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE;
