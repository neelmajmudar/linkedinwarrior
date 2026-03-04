-- Recreate post_embeddings table (pgvector for RAG)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS post_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scraped_post_id TEXT REFERENCES scraped_posts(id) ON DELETE CASCADE,
    content TEXT,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_embeddings_user_id ON post_embeddings(user_id);

ALTER TABLE post_embeddings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'post_embeddings' AND policyname = 'post_embeddings_all'
  ) THEN
    CREATE POLICY post_embeddings_all ON post_embeddings FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

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
