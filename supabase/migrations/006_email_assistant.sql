-- Email Assistant feature tables

-- Stores Gmail account connections via Unipile (separate from LinkedIn)
CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unipile_account_id TEXT NOT NULL,
    email_address TEXT,
    status TEXT NOT NULL DEFAULT 'active',  -- active, disconnected
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, unipile_account_id)
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_unipile ON email_accounts(unipile_account_id);

-- Incoming emails received via Unipile webhook
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
    unipile_email_id TEXT NOT NULL,
    from_name TEXT,
    from_email TEXT NOT NULL,
    to_email TEXT,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    has_attachments BOOLEAN DEFAULT false,
    received_at TIMESTAMPTZ,
    -- AI-generated fields (populated after processing)
    category TEXT,          -- meeting_request, follow_up, introduction, question, newsletter, promotional, personal, other
    action_items JSONB,     -- [{"item": "...", "due": "...", "priority": "..."}]
    priority TEXT,          -- high, medium, low
    status TEXT NOT NULL DEFAULT 'new',  -- new, processing, processed, skipped
    auto_reply_eligible BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
CREATE INDEX IF NOT EXISTS idx_emails_unipile_id ON emails(unipile_email_id);

-- AI-generated reply drafts
CREATE TABLE IF NOT EXISTS email_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',  -- draft, approved, sent, failed
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_user_id ON email_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_email_id ON email_drafts(email_id);

-- User email preferences (auto-send categories, filtering)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_auto_send_categories JSONB DEFAULT '[]';

-- RLS policies
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_accounts_all ON email_accounts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY emails_all ON emails FOR ALL USING (auth.uid() = user_id);

ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_drafts_all ON email_drafts FOR ALL USING (auth.uid() = user_id);
