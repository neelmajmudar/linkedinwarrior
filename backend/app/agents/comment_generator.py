"""LangGraph agent for generating personalized comments on LinkedIn posts."""

import json
from typing import TypedDict

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

from app.config import settings
from app.db import get_supabase


class CommentGenState(TypedDict):
    user_id: str
    post_content: str
    post_author: str
    voice_profile: dict
    comment_draft: str
    review_passed: bool
    review_feedback: str


COMMENT_SYSTEM_PROMPT = """You are a LinkedIn engagement strategist. Your job is to write a thoughtful, personalized comment on someone else's LinkedIn post.

VOICE PROFILE OF THE COMMENTER:
{voice_profile}

RULES:
- Write in the commenter's natural voice and tone (see voice profile above)
- Be genuinely insightful — add value, share a perspective, or ask a thoughtful question
- Reference specific points from the post to show you actually read it
- Keep it concise (2-4 sentences, max 300 characters)
- NO generic comments like "Great post!" or "Thanks for sharing!"
- NO self-promotion or links
- Be authentic and conversational, not sycophantic
- Match the energy and formality level of the original post
- Output ONLY the comment text, nothing else"""


REVIEW_SYSTEM_PROMPT = """You are a quality reviewer for LinkedIn comments. Review the following comment and determine if it meets these criteria:

1. Is it genuinely insightful and adds value?
2. Does it reference specific points from the original post?
3. Is it concise (2-4 sentences)?
4. Does it avoid generic phrases like "Great post!" or "Thanks for sharing!"?
5. Is it free of self-promotion?
6. Does it sound natural and authentic?

Respond with a JSON object:
{
  "passed": true/false,
  "feedback": "brief explanation if failed, empty string if passed",
  "improved_comment": "only if failed, provide an improved version"
}

Return ONLY the JSON object."""


async def load_persona(state: CommentGenState) -> dict:
    """Load the user's voice profile for tone matching."""
    db = get_supabase()
    user_result = db.table("users").select("voice_profile").eq("id", state["user_id"]).execute()

    voice_profile = {}
    if user_result.data and user_result.data[0].get("voice_profile"):
        voice_profile = user_result.data[0]["voice_profile"]

    return {"voice_profile": voice_profile}


async def generate_comment(state: CommentGenState) -> dict:
    """Generate a personalized comment for the target post."""
    llm = ChatOpenAI(
        model="gpt-5-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=500,
    )

    system = COMMENT_SYSTEM_PROMPT.format(
        voice_profile=json.dumps(state["voice_profile"], indent=2) if state["voice_profile"] else "No voice profile available — use a professional, conversational tone."
    )

    messages = [
        SystemMessage(content=system),
        HumanMessage(content=f"Write a comment on this LinkedIn post by {state['post_author']}:\n\n{state['post_content']}"),
    ]

    response = await llm.ainvoke(messages)
    return {"comment_draft": response.content.strip()}


async def review_comment(state: CommentGenState) -> dict:
    """Self-critique step to ensure comment quality and relevance."""
    llm = ChatOpenAI(
        model="gpt-5-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=500,
    )

    messages = [
        SystemMessage(content=REVIEW_SYSTEM_PROMPT),
        HumanMessage(content=f"ORIGINAL POST by {state['post_author']}:\n{state['post_content']}\n\nCOMMENT TO REVIEW:\n{state['comment_draft']}"),
    ]

    response = await llm.ainvoke(messages)
    response_text = response.content

    try:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        review = json.loads(response_text[start:end])

        if review.get("passed", False):
            return {"review_passed": True, "review_feedback": ""}
        else:
            # Use the improved comment if review failed
            improved = review.get("improved_comment", state["comment_draft"])
            return {
                "review_passed": True,
                "comment_draft": improved if improved else state["comment_draft"],
                "review_feedback": review.get("feedback", ""),
            }
    except (json.JSONDecodeError, ValueError):
        # If parsing fails, pass the comment through
        return {"review_passed": True, "review_feedback": ""}


def build_comment_generator_graph() -> StateGraph:
    """Build the LangGraph graph for comment generation."""
    graph = StateGraph(CommentGenState)

    graph.add_node("load_persona", load_persona)
    graph.add_node("generate_comment", generate_comment)
    graph.add_node("review_comment", review_comment)

    graph.set_entry_point("load_persona")
    graph.add_edge("load_persona", "generate_comment")
    graph.add_edge("generate_comment", "review_comment")
    graph.add_edge("review_comment", END)

    return graph.compile()


async def generate_comment_for_post(
    user_id: str,
    post_content: str,
    post_author: str = "Unknown",
) -> str:
    """Generate a personalized comment for a LinkedIn post.

    This is the main entry point for comment generation.
    Returns the generated comment text.
    """
    graph = build_comment_generator_graph()
    result = await graph.ainvoke({
        "user_id": user_id,
        "post_content": post_content,
        "post_author": post_author,
        "voice_profile": {},
        "comment_draft": "",
        "review_passed": False,
        "review_feedback": "",
    })
    return result["comment_draft"]
