-- Analytics snapshot tables for historical tracking

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followers_count INT,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS post_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linkedin_post_id TEXT NOT NULL,
    social_id TEXT,
    post_text TEXT,
    reactions INT DEFAULT 0,
    comments INT DEFAULT 0,
    reposts INT DEFAULT 0,
    impressions INT DEFAULT 0,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(linkedin_post_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user ON analytics_snapshots(user_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_post_analytics_user ON post_analytics(user_id, snapshot_date);

-- RLS
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_snapshots_all ON analytics_snapshots FOR ALL USING (auth.uid() = user_id);

ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_analytics_all ON post_analytics FOR ALL USING (auth.uid() = user_id);
