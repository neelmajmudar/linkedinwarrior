-- Auto-commenting feature tables

CREATE TABLE IF NOT EXISTS auto_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_social_id TEXT NOT NULL,
    post_author TEXT,
    post_content TEXT,
    comment_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, posted, failed, skipped
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_comments_user_id ON auto_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_comments_status ON auto_comments(status);

-- Add engagement topics to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS engagement_topics JSONB DEFAULT '[]';

-- RLS policies for auto_comments
ALTER TABLE auto_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_comments_all ON auto_comments FOR ALL USING (auth.uid() = user_id);
