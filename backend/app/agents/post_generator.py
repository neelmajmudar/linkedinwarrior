"""LangGraph agent for generating LinkedIn posts in the user's voice."""

import json
from typing import AsyncGenerator, TypedDict

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

from app.config import settings
from app.db import get_supabase
from app.services.embeddings import similarity_search


class PostGenState(TypedDict):
    user_id: str
    prompt: str
    voice_profile: dict
    similar_posts: list[dict]
    system_prompt: str
    draft: str
    draft_id: str


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


async def retrieve_context(state: PostGenState) -> dict:
    """Load voice profile and retrieve similar posts via RAG."""
    db = get_supabase()
    user_result = db.table("users").select("voice_profile").eq("id", state["user_id"]).execute()

    if not user_result.data or not user_result.data[0].get("voice_profile"):
        return {
            "voice_profile": {},
            "similar_posts": [],
            "system_prompt": "",
            "draft": "[ERROR] No voice profile found. Please complete onboarding first.",
        }

    voice_profile = user_result.data[0]["voice_profile"]
    similar_posts = await similarity_search(state["user_id"], state["prompt"], limit=5)
    system_prompt = _build_system_prompt(voice_profile, similar_posts)

    return {
        "voice_profile": voice_profile,
        "similar_posts": similar_posts,
        "system_prompt": system_prompt,
    }


async def generate_draft(state: PostGenState) -> dict:
    """Generate the LinkedIn post draft via LLM."""
    if state.get("draft", "").startswith("[ERROR]"):
        return {}

    llm = ChatOpenAI(
        model="gpt-5-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=4000,
    )

    messages = [
        SystemMessage(content=state["system_prompt"]),
        HumanMessage(content=f"Write a LinkedIn post about: {state['prompt']}"),
    ]

    response = await llm.ainvoke(messages)
    return {"draft": response.content}


async def save_draft(state: PostGenState) -> dict:
    """Persist the generated draft to content_items."""
    draft = state.get("draft", "")
    if not draft or draft.startswith("[ERROR]"):
        return {}

    db = get_supabase()
    result = db.table("content_items").insert({
        "user_id": state["user_id"],
        "prompt": state["prompt"],
        "body": draft.strip(),
        "status": "draft",
    }).execute()

    draft_id = result.data[0]["id"] if result.data else ""
    return {"draft_id": draft_id}


def build_post_generator_graph() -> StateGraph:
    """Build the LangGraph graph for post generation."""
    graph = StateGraph(PostGenState)

    graph.add_node("retrieve_context", retrieve_context)
    graph.add_node("generate_draft", generate_draft)
    graph.add_node("save_draft", save_draft)

    graph.set_entry_point("retrieve_context")
    graph.add_edge("retrieve_context", "generate_draft")
    graph.add_edge("generate_draft", "save_draft")
    graph.add_edge("save_draft", END)

    return graph.compile()


# --- Streaming interface for the API ---

async def generate_post_stream(user_id: str, prompt: str) -> AsyncGenerator[str, None]:
    """Generate a LinkedIn post as a streaming response.

    Yields individual text tokens as they arrive from the LLM.
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
    system_prompt = _build_system_prompt(voice_profile, similar_posts)

    # Stream from LLM
    llm = ChatOpenAI(
        model="gpt-5-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=4000,
        streaming=True,
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Write a LinkedIn post about: {prompt}"),
    ]

    full_text = ""
    async for chunk in llm.astream(messages):
        token = chunk.content
        if token:
            full_text += token
            yield token

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
