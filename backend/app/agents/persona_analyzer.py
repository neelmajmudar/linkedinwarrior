"""LangGraph agent for analyzing LinkedIn posts and building a voice profile."""

import json
from typing import TypedDict

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

from app.config import settings
from app.db import get_supabase


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


class PersonaState(TypedDict):
    user_id: str
    posts_text: str
    voice_profile: dict


async def fetch_posts(state: PersonaState) -> dict:
    """Load scraped posts from the database."""
    db = get_supabase()

    result = db.table("scraped_posts") \
        .select("content, posted_at, engagement") \
        .eq("user_id", state["user_id"]) \
        .order("posted_at", desc=True) \
        .execute()

    posts = result.data
    if not posts:
        raise ValueError("No scraped posts found. Run a scrape first.")

    # Limit to top 30 posts to stay within token limits
    posts = posts[:30]

    posts_text = ""
    for i, post in enumerate(posts, 1):
        engagement = post.get("engagement") or {}
        likes = engagement.get("likes", 0)
        comments = engagement.get("comments", 0)
        posts_text += f"\n--- Post {i} (Likes: {likes}, Comments: {comments}) ---\n"
        posts_text += post["content"] + "\n"

    return {"posts_text": posts_text}


async def analyze_voice(state: PersonaState) -> dict:
    """Call LLM to build the voice profile JSON."""
    llm = ChatOpenAI(
        model="gpt-5-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=4000,
    )

    message = await llm.ainvoke([
        HumanMessage(
            content=PERSONA_ANALYSIS_PROMPT + state["posts_text"] + "\n\nReturn ONLY the JSON object, no other text."
        ),
    ])

    response_text = message.content
    start = response_text.find("{")
    end = response_text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"LLM did not return valid JSON. Raw response: {response_text[:500]}")

    voice_profile = json.loads(response_text[start:end])
    return {"voice_profile": voice_profile}


async def store_profile(state: PersonaState) -> dict:
    """Save the voice profile to the users table."""
    db = get_supabase()
    db.table("users").update({
        "voice_profile": state["voice_profile"],
    }).eq("id", state["user_id"]).execute()

    return {}


def build_persona_analyzer_graph() -> StateGraph:
    """Build the LangGraph graph for persona analysis."""
    graph = StateGraph(PersonaState)

    graph.add_node("fetch_posts", fetch_posts)
    graph.add_node("analyze_voice", analyze_voice)
    graph.add_node("store_profile", store_profile)

    graph.set_entry_point("fetch_posts")
    graph.add_edge("fetch_posts", "analyze_voice")
    graph.add_edge("analyze_voice", "store_profile")
    graph.add_edge("store_profile", END)

    return graph.compile()


async def build_voice_profile(user_id: str) -> dict:
    """Analyze all scraped posts and generate a structured voice profile.

    This is the main entry point, compatible with the existing service interface.
    """
    graph = build_persona_analyzer_graph()
    result = await graph.ainvoke({"user_id": user_id, "posts_text": "", "voice_profile": {}})
    return result["voice_profile"]
