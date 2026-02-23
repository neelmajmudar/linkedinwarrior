import openai
from app.config import settings
from app.db import get_supabase

_openai_client: openai.AsyncOpenAI | None = None


def _get_openai() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


async def embed_text(text: str) -> list[float]:
    """Generate an embedding for a single text string using OpenAI text-embedding-3-small."""
    client = _get_openai()
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


async def embed_and_store_posts(user_id: str) -> int:
    """Embed all scraped posts for a user and store in post_embeddings.

    Returns the number of embeddings created.
    """
    db = get_supabase()

    # Fetch all scraped posts for this user
    result = db.table("scraped_posts").select("id, content").eq("user_id", user_id).execute()
    posts = result.data
    if not posts:
        return 0

    # Delete old embeddings
    db.table("post_embeddings").delete().eq("user_id", user_id).execute()

    # Batch embed (OpenAI supports batch in a single call)
    texts = [p["content"] for p in posts]
    client = _get_openai()

    # Process in batches of 100 to stay within API limits
    batch_size = 100
    all_rows = []

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i : i + batch_size]
        batch_posts = posts[i : i + batch_size]

        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=batch_texts,
        )

        for j, emb_data in enumerate(response.data):
            all_rows.append({
                "user_id": user_id,
                "scraped_post_id": batch_posts[j]["id"],
                "content": batch_posts[j]["content"],
                "embedding": emb_data.embedding,
            })

    # Insert into Supabase — pgvector expects the embedding as a list
    if all_rows:
        db.table("post_embeddings").insert(all_rows).execute()

    return len(all_rows)


async def similarity_search(user_id: str, query: str, limit: int = 5) -> list[dict]:
    """Find the most similar posts to a query string using cosine similarity."""
    query_embedding = await embed_text(query)
    db = get_supabase()

    # Call the Supabase RPC function for vector similarity search
    result = db.rpc("match_posts", {
        "query_embedding": query_embedding,
        "match_user_id": user_id,
        "match_count": limit,
    }).execute()

    return result.data or []
