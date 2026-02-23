import json
import openai
from app.config import settings
from app.db import get_supabase

_openai_client: openai.AsyncOpenAI | None = None


def _get_openai() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


PERSONA_ANALYSIS_PROMPT = """Analyze the following LinkedIn posts written by a single person. Your job is to create a detailed voice profile that captures exactly how this person writes, thinks, and communicates.

Return a JSON object with these fields:
{
  "tone": "description of their overall tone (e.g. direct, conversational, formal, humorous)",
  "sentence_style": "how they structure sentences (short/long, use of line breaks, punctuation habits)",
  "recurring_themes": ["list of topics they frequently write about"],
  "strong_opinions": ["specific opinions or takes they've expressed"],
  "vocabulary": ["distinctive words or phrases they use repeatedly"],
  "post_structures": ["patterns in how they structure posts, e.g. 'hook → story → lesson'"],
  "example_hooks": ["real opening lines from their best posts"],
  "what_to_avoid": ["things this person would never say or styles they don't use"],
  "personality_traits": ["inferred personality traits from their writing"],
  "industry_context": "their industry, role, and professional context"
}

Be extremely specific. Use actual quotes and examples from their posts. The goal is that someone reading this profile could write a post indistinguishable from the original author.

Here are their posts (most recent first):

"""


async def build_voice_profile(user_id: str) -> dict:
    """Analyze all scraped posts and generate a structured voice profile."""
    db = get_supabase()

    # Fetch all scraped posts
    result = db.table("scraped_posts") \
        .select("content, posted_at, engagement") \
        .eq("user_id", user_id) \
        .order("posted_at", desc=True) \
        .execute()

    posts = result.data
    if not posts:
        raise ValueError("No scraped posts found. Run a scrape first.")

    # Limit to top 30 posts to stay within token limits
    posts = posts[:30]

    # Build the posts text block
    posts_text = ""
    for i, post in enumerate(posts, 1):
        engagement = post.get("engagement") or {}
        likes = engagement.get("likes", 0)
        comments = engagement.get("comments", 0)
        posts_text += f"\n--- Post {i} (Likes: {likes}, Comments: {comments}) ---\n"
        posts_text += post["content"] + "\n"

    # Call OpenAI to analyze
    client = _get_openai()
    message = await client.chat.completions.create(
        model="gpt-5-mini",
        max_completion_tokens=4000,
        messages=[{
            "role": "user",
            "content": PERSONA_ANALYSIS_PROMPT + posts_text + "\n\nReturn ONLY the JSON object, no other text.",
        }],
    )

    # Parse JSON from response
    response_text = message.choices[0].message.content
    start = response_text.find("{")
    end = response_text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"LLM did not return valid JSON. Raw response: {response_text[:500]}")
    voice_profile = json.loads(response_text[start:end])

    # Store on user record
    db.table("users").update({
        "voice_profile": voice_profile,
    }).eq("id", user_id).execute()

    return voice_profile
