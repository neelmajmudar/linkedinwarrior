-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    linkedin_username TEXT,
    unipile_account_id TEXT,
    voice_profile JSONB,
    scrape_status TEXT DEFAULT 'none',
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Scraped LinkedIn posts from Apify
CREATE TABLE IF NOT EXISTS scraped_posts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    posted_at TIMESTAMPTZ,
    engagement JSONB,
    linkedin_url TEXT,
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scraped_posts_user_id ON scraped_posts(user_id);

-- Post embeddings for RAG (pgvector)
CREATE TABLE IF NOT EXISTS post_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scraped_post_id TEXT REFERENCES scraped_posts(id) ON DELETE CASCADE,
    content TEXT,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_embeddings_user_id ON post_embeddings(user_id);

-- Content items (drafts, scheduled, published posts)
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    linkedin_post_id TEXT,
    engagement JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_items_user_id ON content_items(user_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_scheduled ON content_items(scheduled_at) WHERE status = 'scheduled';

-- RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own row
CREATE POLICY users_select ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Scraped posts: full CRUD on own
CREATE POLICY scraped_posts_all ON scraped_posts FOR ALL USING (auth.uid() = user_id);

-- Post embeddings: full CRUD on own
CREATE POLICY post_embeddings_all ON post_embeddings FOR ALL USING (auth.uid() = user_id);

-- Content items: full CRUD on own
CREATE POLICY content_items_select ON content_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY content_items_insert ON content_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY content_items_update ON content_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY content_items_delete ON content_items FOR DELETE USING (auth.uid() = user_id);

-- Vector similarity search function (used by the backend)
CREATE OR REPLACE FUNCTION match_posts(
    query_embedding vector(1536),
    match_user_id UUID,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    scraped_post_id TEXT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pe.id,
        pe.scraped_post_id,
        pe.content,
        1 - (pe.embedding <=> query_embedding) AS similarity
    FROM post_embeddings pe
    WHERE pe.user_id = match_user_id
    ORDER BY pe.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
