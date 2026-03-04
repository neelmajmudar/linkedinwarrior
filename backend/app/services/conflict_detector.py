"""Conflict detection engine for team content scheduling.

Two detection modes triggered at schedule time:
1. Time Proximity — pure SQL, no LLM
2. Topic/Theme Deduplication — GPT-4.1-mini call
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from openai import AsyncOpenAI

from app.config import settings
from app.db import get_supabase

logger = logging.getLogger(__name__)


async def check_conflicts(
    org_id: str,
    scheduled_at: str,
    body: str,
    exclude_content_id: Optional[str] = None,
) -> dict:
    """Run both time-proximity and topic-similarity checks for a proposed post.

    Returns:
        {
            "time_conflicts": [...],
            "topic_conflicts": [...],
            "has_conflicts": bool,
        }
    """
    time_conflicts = await _check_time_proximity(org_id, scheduled_at, exclude_content_id)
    topic_conflicts = await _check_topic_similarity(org_id, scheduled_at, body, exclude_content_id)

    return {
        "time_conflicts": time_conflicts,
        "topic_conflicts": topic_conflicts,
        "has_conflicts": len(time_conflicts) > 0 or len(topic_conflicts) > 0,
    }


async def _check_time_proximity(
    org_id: str,
    scheduled_at: str,
    exclude_content_id: Optional[str] = None,
) -> list[dict]:
    """Find posts in the same org scheduled within ±2 hours."""
    db = get_supabase()

    try:
        target_dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        return []

    window_start = (target_dt - timedelta(hours=2)).isoformat()
    window_end = (target_dt + timedelta(hours=2)).isoformat()

    query = db.table("content_items") \
        .select("id, user_id, body, scheduled_at, status") \
        .eq("org_id", org_id) \
        .in_("status", ["scheduled", "publishing"]) \
        .gte("scheduled_at", window_start) \
        .lte("scheduled_at", window_end)

    if exclude_content_id:
        query = query.neq("id", exclude_content_id)

    result = query.execute()

    if not result.data:
        return []

    # Enrich with member info
    members_result = db.table("org_members") \
        .select("user_id, display_name, color") \
        .eq("org_id", org_id) \
        .execute()
    member_map = {m["user_id"]: m for m in (members_result.data or [])}

    conflicts = []
    for item in result.data:
        item_dt = datetime.fromisoformat(item["scheduled_at"].replace("Z", "+00:00"))
        gap_minutes = abs((target_dt - item_dt).total_seconds()) / 60
        severity = "hard_conflict" if gap_minutes <= 60 else "warning"
        m = member_map.get(item["user_id"], {})

        conflicts.append({
            "content_id": item["id"],
            "member_display_name": m.get("display_name"),
            "member_color": m.get("color"),
            "scheduled_at": item["scheduled_at"],
            "body_preview": item["body"][:100] + "..." if len(item["body"]) > 100 else item["body"],
            "gap_minutes": round(gap_minutes),
            "severity": severity,
            "type": "time_proximity",
        })

    return conflicts


async def _check_topic_similarity(
    org_id: str,
    scheduled_at: str,
    body: str,
    exclude_content_id: Optional[str] = None,
) -> list[dict]:
    """Use GPT-4.1-mini to detect thematic overlap with nearby org posts."""
    if not settings.OPENAI_API_KEY or not body.strip():
        return []

    db = get_supabase()

    try:
        target_dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        return []

    window_start = (target_dt - timedelta(days=3)).isoformat()
    window_end = (target_dt + timedelta(days=3)).isoformat()

    query = db.table("content_items") \
        .select("id, user_id, body, scheduled_at, status") \
        .eq("org_id", org_id) \
        .in_("status", ["draft", "scheduled", "publishing", "published"]) \
        .gte("scheduled_at", window_start) \
        .lte("scheduled_at", window_end)

    if exclude_content_id:
        query = query.neq("id", exclude_content_id)

    result = query.execute()

    nearby_posts = result.data or []
    if not nearby_posts:
        return []

    # Enrich with member info
    members_result = db.table("org_members") \
        .select("user_id, display_name, color") \
        .eq("org_id", org_id) \
        .execute()
    member_map = {m["user_id"]: m for m in (members_result.data or [])}

    # Build prompt
    posts_text = ""
    for i, post in enumerate(nearby_posts[:15], 1):
        m = member_map.get(post["user_id"], {})
        name = m.get("display_name", "Unknown")
        posts_text += f"\n[Post {i}] by {name} (scheduled: {post['scheduled_at']}):\n{post['body'][:500]}\n"

    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model="gpt-4.1-mini",
            max_tokens=1000,
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a content strategist analyzing a team's LinkedIn posting calendar for topic conflicts. "
                        "Given a PROPOSED post and a list of EXISTING scheduled posts from the same team, identify any posts "
                        "that cover substantially the same topic, angle, or narrative. Minor thematic overlap is fine — "
                        "flag only when two posts would feel redundant or repetitive to their shared audience.\n\n"
                        "Respond in JSON format:\n"
                        '{"conflicts": [{"post_index": <number>, "similarity": "high"|"medium", '
                        '"explanation": "<brief reason>", "suggestion": "<how to differentiate>"}]}\n\n'
                        "If no conflicts, return: {\"conflicts\": []}"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"PROPOSED POST:\n{body[:1000]}\n\n"
                        f"EXISTING TEAM POSTS (±3 days):\n{posts_text}"
                    ),
                },
            ],
        )

        content = response.choices[0].message.content or "{}"
        # Strip markdown code fences if present
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        data = json.loads(content)
        llm_conflicts = data.get("conflicts", [])

        results = []
        for conflict in llm_conflicts:
            idx = conflict.get("post_index", 0)
            if idx < 1 or idx > len(nearby_posts):
                continue
            post = nearby_posts[idx - 1]
            m = member_map.get(post["user_id"], {})
            results.append({
                "content_id": post["id"],
                "member_display_name": m.get("display_name"),
                "member_color": m.get("color"),
                "scheduled_at": post["scheduled_at"],
                "body_preview": post["body"][:100] + "..." if len(post["body"]) > 100 else post["body"],
                "similarity": conflict.get("similarity", "medium"),
                "explanation": conflict.get("explanation", ""),
                "suggestion": conflict.get("suggestion", ""),
                "severity": "warning" if conflict.get("similarity") == "medium" else "hard_conflict",
                "type": "topic_similarity",
            })

        return results

    except Exception as e:
        logger.error(f"[conflict_detector] Topic similarity check failed: {e}")
        return []
