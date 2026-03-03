-- Drop the vector similarity search function (no longer used)
DROP FUNCTION IF EXISTS match_posts(vector(1536), UUID, INT);

-- Drop the post_embeddings table (replaced by persona report approach)
DROP TABLE IF EXISTS post_embeddings;
