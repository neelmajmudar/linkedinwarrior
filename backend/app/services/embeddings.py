"""Embedding service for RAG-powered content generation.

Uses OpenAI text-embedding-3-small (1536 dimensions) to embed scraped LinkedIn posts
and stores them in the post_embeddings table (pgvector).
"""

import asyncio
from typing import List, Tuple

from openai import AsyncOpenAI

from app.config import settings
from app.db import get_supabase

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
BATCH_SIZE = 100  # OpenAI supports up to 2048 inputs per request


async def _get_embeddings(texts: List[str]) -> List[List[float]]:
    """Call OpenAI embeddings API for a list of texts."""
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
        dimensions=EMBEDDING_DIMENSIONS,
    )
    return [item.embedding for item in response.data]


async def embed_posts_for_user(user_id: str) -> int:
    """Generate embeddings for all scraped posts that don't already have embeddings.

    Returns the number of new embeddings created.
    """
    db = get_supabase()

    # Get all scraped posts for this user
    posts_result = (
        db.table("scraped_posts")
        .select("id, content")
        .eq("user_id", user_id)
        .execute()
    )
    all_posts = posts_result.data or []
    if not all_posts:
        print(f"[embeddings] No scraped posts found for user={user_id}")
        return 0

    # Get existing embedding post IDs to avoid duplicates
    existing_result = (
        db.table("post_embeddings")
        .select("scraped_post_id")
        .eq("user_id", user_id)
        .execute()
    )
    existing_ids = {row["scraped_post_id"] for row in (existing_result.data or [])}

    # Filter to posts that need embeddings
    posts_to_embed: List[Tuple[str, str]] = []
    for post in all_posts:
        if post["id"] not in existing_ids and post.get("content", "").strip():
            posts_to_embed.append((post["id"], post["content"].strip()))

    if not posts_to_embed:
        print(f"[embeddings] All {len(all_posts)} posts already embedded for user={user_id}")
        return 0

    print(f"[embeddings] Embedding {len(posts_to_embed)} posts for user={user_id}")

    total_embedded = 0

    # Process in batches
    for i in range(0, len(posts_to_embed), BATCH_SIZE):
        batch = posts_to_embed[i : i + BATCH_SIZE]
        post_ids = [p[0] for p in batch]
        texts = [p[1] for p in batch]

        try:
            embeddings = await _get_embeddings(texts)
        except Exception as e:
            print(f"[embeddings] OpenAI API error on batch {i // BATCH_SIZE}: {e}")
            continue

        # Build rows for upsert
        rows = []
        for post_id, text, embedding in zip(post_ids, texts, embeddings):
            rows.append({
                "user_id": user_id,
                "scraped_post_id": post_id,
                "content": text,
                "embedding": embedding,
            })

        try:
            db.table("post_embeddings").insert(rows).execute()
            total_embedded += len(rows)
        except Exception as e:
            print(f"[embeddings] DB insert error on batch {i // BATCH_SIZE}: {e}")
            continue

    print(f"[embeddings] Stored {total_embedded} embeddings for user={user_id}")
    return total_embedded


async def reembed_all_posts_for_user(user_id: str) -> int:
    """Delete existing embeddings and re-embed all posts from scratch.

    Use after a fresh scrape that replaces all scraped_posts.
    Returns the number of embeddings created.
    """
    db = get_supabase()

    # Delete existing embeddings
    db.table("post_embeddings").delete().eq("user_id", user_id).execute()
    print(f"[embeddings] Cleared old embeddings for user={user_id}")

    return await embed_posts_for_user(user_id)


async def search_similar_posts(
    user_id: str,
    query: str,
    match_count: int = 8,
) -> List[dict]:
    """Find posts similar to a query using vector similarity search.

    Returns a list of {content, similarity} dicts ordered by relevance.
    """
    # Embed the query
    embeddings = await _get_embeddings([query])
    query_embedding = embeddings[0]

    db = get_supabase()

    # Call the match_posts RPC function
    result = db.rpc(
        "match_posts",
        {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_count": match_count,
        },
    ).execute()

    return result.data or []
