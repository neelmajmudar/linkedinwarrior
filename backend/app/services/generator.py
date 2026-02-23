import json
from typing import AsyncGenerator
import openai
from app.config import settings
from app.db import get_supabase
from app.services.embeddings import similarity_search

_openai_client: openai.AsyncOpenAI | None = None


def _get_openai() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def _build_system_prompt(voice_profile: dict, similar_posts: list[dict]) -> str:
    posts_block = ""
    for i, post in enumerate(similar_posts, 1):
        posts_block += f"\n--- Example {i} ---\n{post.get('content', '')}\n"

    return f"""You are a ghostwriter. Write a LinkedIn post for this person.

VOICE PROFILE:
{json.dumps(voice_profile, indent=2)}

THEIR PAST POSTS (for style reference — match the voice, do NOT copy content):
{posts_block}

RULES:
- Match their exact tone, sentence length, and structure patterns
- Use their vocabulary and phrasing style
- Follow their typical post structure (see post_structures in the profile)
- No hashtag spam (max 2-3 relevant hashtags, only if they typically use them)
- No corporate buzzwords unless they use them
- Keep it under 2500 characters
- Output ONLY the post text, nothing else — no preamble, no explanation"""


async def generate_post_stream(user_id: str, prompt: str) -> AsyncGenerator[str, None]:
    """Generate a LinkedIn post as a streaming response.

    Yields individual text tokens as they arrive from Claude.
    Also saves the complete draft to content_items when done.
    """
    db = get_supabase()

    # Load voice profile
    user_result = db.table("users").select("voice_profile").eq("id", user_id).execute()
    if not user_result.data:
        yield "[ERROR] No user profile found. Please complete onboarding first."
        return
    voice_profile = user_result.data[0].get("voice_profile")
    if not voice_profile:
        yield "[ERROR] No voice profile found. Please complete onboarding first."
        return

    # RAG: retrieve similar posts
    similar_posts = await similarity_search(user_id, prompt, limit=5)

    # Build prompt
    system = _build_system_prompt(voice_profile, similar_posts)

    # Stream from OpenAI
    client = _get_openai()
    full_text = ""

    stream = await client.chat.completions.create(
        model="gpt-5-mini",
        max_completion_tokens=4000,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": f"Write a LinkedIn post about: {prompt}"},
        ],
        stream=True,
    )
    async for chunk in stream:
        text = chunk.choices[0].delta.content
        if text:
            full_text += text
            yield text

    # Save as draft
    db.table("content_items").insert({
        "user_id": user_id,
        "prompt": prompt,
        "body": full_text.strip(),
        "status": "draft",
    }).execute()


async def generate_post(user_id: str, prompt: str) -> str:
    """Generate a LinkedIn post (non-streaming). Returns the full text."""
    full_text = ""
    async for token in generate_post_stream(user_id, prompt):
        full_text += token
    return full_text
