"""LangGraph agent for processing incoming emails and generating reply drafts.

Classifies emails, extracts action items, and generates professional reply drafts
using the user's LinkedIn voice profile and post embeddings for style reference.
"""

import json
from typing import TypedDict

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

from app.config import settings
from app.db import get_supabase
from app.services.embeddings import similarity_search


# Categories that should be skipped (no reply draft generated)
SKIP_CATEGORIES = {"newsletter", "promotional"}

# Categories eligible for auto-send (user can opt in per category)
AUTO_REPLY_CATEGORIES = {"meeting_request", "follow_up", "introduction", "question"}


class EmailResponderState(TypedDict):
    user_id: str
    email_id: str
    email_subject: str
    email_body: str
    from_name: str
    from_email: str
    voice_profile: dict
    similar_posts: list[dict]
    category: str
    action_items: list[dict]
    priority: str
    draft_subject: str
    draft_reply: str
    should_skip: bool


CLASSIFY_PROMPT = """You are an email triage assistant. Analyze the following email and return a JSON object with:

1. "category": one of ["meeting_request", "follow_up", "introduction", "question", "newsletter", "promotional", "personal", "other"]
2. "action_items": a list of action items extracted from the email. Each item should have:
   - "item": description of the action
   - "due": due date if mentioned, otherwise null
   - "priority": "high", "medium", or "low"
3. "priority": overall priority of this email — "high", "medium", or "low"
4. "needs_reply": true if this email warrants a reply, false if it's informational only

Classification rules:
- "newsletter" = mass-sent content, blog digests, automated updates from services
- "promotional" = marketing emails, sales pitches, discount offers
- "meeting_request" = scheduling, calendar invites, meeting proposals
- "follow_up" = someone following up on a previous conversation or task
- "introduction" = someone introducing themselves or being introduced
- "question" = someone asking a direct question expecting a response
- "personal" = personal/social emails from known contacts
- "other" = anything that doesn't fit above

Return ONLY the JSON object, no other text.

EMAIL:
From: {from_name} <{from_email}>
Subject: {subject}

{body}"""


REPLY_SYSTEM_PROMPT = """You are a professional email ghostwriter. Write a reply to the email below on behalf of the person whose voice profile is provided.

VOICE PROFILE (from their LinkedIn writing — match this tone and style):
{voice_profile}

THEIR WRITING EXAMPLES (for style reference — match voice, NOT content):
{similar_posts}

RULES:
- Write in the person's natural voice and professional tone
- Be concise and direct — aim for 3-8 sentences
- Address the specific points raised in the original email
- Include any necessary next steps or answers
- Be warm but professional
- Do NOT include a subject line — just the email body
- Do NOT include greetings like "Dear" unless the person's style uses them
- Do NOT include sign-offs like "Best regards" unless the person's style uses them
- Output ONLY the reply text, nothing else — no preamble, no explanation

ORIGINAL EMAIL:
From: {from_name} <{from_email}>
Subject: {subject}

{body}"""


async def classify_email(state: EmailResponderState) -> dict:
    """Classify the email and extract action items."""
    llm = ChatOpenAI(
        model="gpt-5-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=1000,
    )

    prompt = CLASSIFY_PROMPT.format(
        from_name=state["from_name"],
        from_email=state["from_email"],
        subject=state["email_subject"],
        body=state["email_body"][:3000],
    )

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    response_text = response.content

    try:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        result = json.loads(response_text[start:end])

        category = result.get("category", "other")
        action_items = result.get("action_items", [])
        priority = result.get("priority", "medium")
        needs_reply = result.get("needs_reply", True)

        should_skip = category in SKIP_CATEGORIES or not needs_reply

        return {
            "category": category,
            "action_items": action_items,
            "priority": priority,
            "should_skip": should_skip,
        }
    except (json.JSONDecodeError, ValueError):
        return {
            "category": "other",
            "action_items": [],
            "priority": "medium",
            "should_skip": False,
        }


async def retrieve_context(state: EmailResponderState) -> dict:
    """Load voice profile and retrieve similar posts for style reference."""
    if state.get("should_skip", False):
        return {"voice_profile": {}, "similar_posts": []}

    db = get_supabase()
    user_result = db.table("users").select("voice_profile").eq("id", state["user_id"]).execute()

    if not user_result.data or not user_result.data[0].get("voice_profile"):
        return {"voice_profile": {}, "similar_posts": []}

    voice_profile = user_result.data[0]["voice_profile"]

    # Use email subject + first part of body as the query for similarity search
    query = f"{state['email_subject']} {state['email_body'][:500]}"
    similar_posts = await similarity_search(state["user_id"], query, limit=5)

    return {
        "voice_profile": voice_profile,
        "similar_posts": similar_posts,
    }


async def generate_reply(state: EmailResponderState) -> dict:
    """Generate a professional reply draft using the user's voice profile."""
    if state.get("should_skip", False):
        return {"draft_subject": "", "draft_reply": ""}

    if not state.get("voice_profile"):
        return {"draft_subject": "", "draft_reply": "[No voice profile available — complete onboarding first]"}

    posts_block = ""
    for i, post in enumerate(state.get("similar_posts", []), 1):
        posts_block += f"\n--- Example {i} ---\n{post.get('content', '')}\n"

    system_prompt = REPLY_SYSTEM_PROMPT.format(
        voice_profile=json.dumps(state["voice_profile"], indent=2),
        similar_posts=posts_block if posts_block else "No examples available.",
        from_name=state["from_name"],
        from_email=state["from_email"],
        subject=state["email_subject"],
        body=state["email_body"][:3000],
    )

    llm = ChatOpenAI(
        model="gpt-5-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=2000,
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content="Write a professional reply to this email."),
    ]

    response = await llm.ainvoke(messages)

    # Generate reply subject
    subject = state["email_subject"]
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    return {
        "draft_subject": subject,
        "draft_reply": response.content.strip(),
    }


async def save_results(state: EmailResponderState) -> dict:
    """Persist classification results and draft reply to the database."""
    db = get_supabase()

    # Update the email record with classification
    auto_reply_eligible = state["category"] in AUTO_REPLY_CATEGORIES
    db.table("emails").update({
        "category": state["category"],
        "action_items": state["action_items"],
        "priority": state["priority"],
        "auto_reply_eligible": auto_reply_eligible,
        "status": "skipped" if state.get("should_skip") else "processed",
    }).eq("id", state["email_id"]).execute()

    # Save draft reply if we generated one
    if state.get("draft_reply") and not state.get("should_skip"):
        db.table("email_drafts").insert({
            "user_id": state["user_id"],
            "email_id": state["email_id"],
            "subject": state.get("draft_subject", ""),
            "body": state["draft_reply"],
            "status": "draft",
        }).execute()

    return {}


def _should_generate_reply(state: EmailResponderState) -> str:
    """Routing function: skip reply generation for newsletters/promotional."""
    if state.get("should_skip", False):
        return "save_results"
    return "retrieve_context"


def build_email_responder_graph() -> StateGraph:
    """Build the LangGraph graph for email processing."""
    graph = StateGraph(EmailResponderState)

    graph.add_node("classify_email", classify_email)
    graph.add_node("retrieve_context", retrieve_context)
    graph.add_node("generate_reply", generate_reply)
    graph.add_node("save_results", save_results)

    graph.set_entry_point("classify_email")
    graph.add_conditional_edges(
        "classify_email",
        _should_generate_reply,
        {
            "retrieve_context": "retrieve_context",
            "save_results": "save_results",
        },
    )
    graph.add_edge("retrieve_context", "generate_reply")
    graph.add_edge("generate_reply", "save_results")
    graph.add_edge("save_results", END)

    return graph.compile()


async def process_email(
    user_id: str,
    email_id: str,
    email_subject: str,
    email_body: str,
    from_name: str,
    from_email: str,
) -> dict:
    """Process an incoming email through the full pipeline.

    This is the main entry point called by the Celery task or directly.
    Returns the classification results and draft reply.
    """
    graph = build_email_responder_graph()
    result = await graph.ainvoke({
        "user_id": user_id,
        "email_id": email_id,
        "email_subject": email_subject,
        "email_body": email_body,
        "from_name": from_name,
        "from_email": from_email,
        "voice_profile": {},
        "similar_posts": [],
        "category": "",
        "action_items": [],
        "priority": "medium",
        "draft_subject": "",
        "draft_reply": "",
        "should_skip": False,
    })
    return {
        "category": result["category"],
        "action_items": result["action_items"],
        "priority": result["priority"],
        "draft_reply": result["draft_reply"],
        "should_skip": result["should_skip"],
    }
