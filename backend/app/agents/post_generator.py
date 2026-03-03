"""LangGraph agent for generating LinkedIn posts using the persona report."""

import json
from typing import AsyncGenerator, TypedDict

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

from app.config import settings
from app.db import get_supabase


class PostGenState(TypedDict):
    user_id: str
    prompt: str
    voice_profile: dict
    system_prompt: str
    draft: str
    draft_id: str


def _build_system_prompt(voice_profile: dict) -> str:
    """Build a system prompt from the comprehensive persona report."""
    # Extract key sections for a focused ghostwriting prompt
    executive_summary = voice_profile.get("executive_summary", "")
    writing_style = json.dumps(voice_profile.get("writing_style_guide", {}), indent=2)
    voice_dna = json.dumps(voice_profile.get("voice_dna", {}), indent=2)
    thinking = json.dumps(voice_profile.get("thinking_profile", {}), indent=2)
    hooks = json.dumps(voice_profile.get("hook_patterns", {}), indent=2)
    rules = json.dumps(voice_profile.get("ghostwriting_rules", {}), indent=2)
    content_strategy = json.dumps(voice_profile.get("content_strategy", {}), indent=2)

    return f"""You are an expert ghostwriter. Write a LinkedIn post that is INDISTINGUISHABLE from the original author.

## WHO THIS PERSON IS
{executive_summary}

## WRITING STYLE GUIDE
{writing_style}

## VOICE DNA
{voice_dna}

## HOW THEY THINK
{thinking}

## HOOK PATTERNS
{hooks}

## CONTENT STRATEGY
{content_strategy}

## GHOSTWRITING RULES
{rules}

## YOUR RULES
- Match their EXACT tone, sentence length, line break patterns, and structure
- Use their signature phrases and vocabulary naturally
- Follow their typical post templates (see writing_style_guide.post_templates)
- Apply their hook patterns — open the post the way they would
- Match their punctuation, emoji, and formatting habits precisely
- No hashtag spam (only use hashtags if and how they typically use them)
- No corporate buzzwords unless they use them
- Keep it under 2500 characters
- Output ONLY the post text, nothing else — no preamble, no explanation"""


async def retrieve_context(state: PostGenState) -> dict:
    """Load the persona report (voice profile) from the database."""
    db = get_supabase()
    user_result = db.table("users").select("voice_profile").eq("id", state["user_id"]).execute()

    if not user_result.data or not user_result.data[0].get("voice_profile"):
        return {
            "voice_profile": {},
            "system_prompt": "",
            "draft": "[ERROR] No voice profile found. Please complete onboarding first.",
        }

    voice_profile = user_result.data[0]["voice_profile"]
    system_prompt = _build_system_prompt(voice_profile)

    return {
        "voice_profile": voice_profile,
        "system_prompt": system_prompt,
    }


async def generate_draft(state: PostGenState) -> dict:
    """Generate the LinkedIn post draft via LLM."""
    if state.get("draft", "").startswith("[ERROR]"):
        return {}

    llm = ChatOpenAI(
        model="gpt-4.1-mini",
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

    # Load persona report
    user_result = db.table("users").select("voice_profile").eq("id", user_id).execute()
    if not user_result.data:
        yield "[ERROR] No user profile found. Please complete onboarding first."
        return
    voice_profile = user_result.data[0].get("voice_profile")
    if not voice_profile:
        yield "[ERROR] No voice profile found. Please complete onboarding first."
        return

    system_prompt = _build_system_prompt(voice_profile)

    # Stream from LLM
    llm = ChatOpenAI(
        model="gpt-4.1-mini",
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
