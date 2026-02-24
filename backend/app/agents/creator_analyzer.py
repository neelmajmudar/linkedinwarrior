"""LangGraph agent for analyzing top LinkedIn creators and generating style reports."""

import json
from typing import TypedDict

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

from app.config import settings


class CreatorAnalysisState(TypedDict):
    niche: str
    creator_profiles: list[dict]  # [{name, public_identifier, headline, posts: [...]}]
    individual_analyses: list[dict]  # per-creator analysis results
    final_report: dict  # compiled cross-creator report


CREATOR_ANALYSIS_PROMPT = """You are a LinkedIn content strategist. Analyze the following posts from a LinkedIn creator and produce a detailed style profile.

CREATOR: {creator_name}
HEADLINE: {creator_headline}

POSTS:
{posts_text}

Return a JSON object with these fields:
{{
  "creator_name": "{creator_name}",
  "headline": "{creator_headline}",
  "writing_style": "detailed description of their writing style, tone, and voice",
  "common_topics": ["list of topics they frequently write about"],
  "post_structure_patterns": ["patterns in how they structure posts - hooks, body, CTAs"],
  "hook_examples": ["3-5 actual opening lines from their posts that work well"],
  "engagement_tactics": ["tactics they use to drive engagement - questions, CTAs, formatting tricks"],
  "vocabulary_signature": ["distinctive words, phrases, or expressions they use"],
  "content_formats": ["types of content they post - stories, lists, hot takes, etc."],
  "strengths": ["what they do exceptionally well"],
  "weaknesses": ["areas where their content could improve"],
  "key_takeaways": ["3-5 actionable lessons you can learn from this creator"]
}}

Return ONLY the JSON object, no other text."""


REPORT_COMPILATION_PROMPT = """You are a LinkedIn content strategist compiling a comprehensive creator analysis report.

NICHE: {niche}

INDIVIDUAL CREATOR ANALYSES:
{analyses_text}

Compile a comprehensive report that synthesizes insights across all creators. Return a JSON object:
{{
  "niche": "{niche}",
  "executive_summary": "2-3 paragraph overview of what makes top creators in this niche successful",
  "cross_creator_patterns": [
    "pattern 1 that multiple creators share",
    "pattern 2",
    "..."
  ],
  "top_hooks_and_formats": [
    "most effective hook/format pattern 1",
    "..."
  ],
  "content_strategy_recommendations": [
    "actionable recommendation 1 for someone wanting to succeed in this niche",
    "recommendation 2",
    "..."
  ],
  "topics_that_perform": ["topics that consistently get engagement across creators"],
  "formatting_best_practices": ["formatting patterns that work - line breaks, emojis, lists, etc."],
  "style_comparison_matrix": [
    {{
      "creator": "name",
      "style_in_one_line": "brief style description",
      "best_for": "what type of content they excel at"
    }}
  ],
  "avoid_these_mistakes": ["common pitfalls to avoid based on what underperforms"],
  "action_plan": "A concise 5-step action plan for creating content in this niche"
}}

Return ONLY the JSON object, no other text."""


async def analyze_single_creator(state: CreatorAnalysisState) -> dict:
    """Analyze each creator's posts individually."""
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=4000,
    )

    analyses = []
    for creator in state["creator_profiles"]:
        name = creator.get("name", "Unknown")
        headline = creator.get("headline", "")
        posts = creator.get("posts", [])

        if not posts:
            continue

        # Format posts for the prompt
        posts_text = ""
        for i, post in enumerate(posts[:15], 1):
            text = post.get("text", "")
            reactions = post.get("reaction_counter", 0)
            comments = post.get("comment_counter", 0)
            posts_text += f"\n--- Post {i} (Reactions: {reactions}, Comments: {comments}) ---\n"
            posts_text += text[:1000] + "\n"

        prompt = CREATOR_ANALYSIS_PROMPT.format(
            creator_name=name,
            creator_headline=headline,
            posts_text=posts_text,
        )

        try:
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            response_text = response.content
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                analysis = json.loads(response_text[start:end])
                analyses.append(analysis)
        except Exception as e:
            print(f"[creator_analyzer] Failed to analyze {name}: {e}")
            analyses.append({
                "creator_name": name,
                "headline": headline,
                "error": str(e),
            })

    return {"individual_analyses": analyses}


async def compile_report(state: CreatorAnalysisState) -> dict:
    """Compile individual analyses into a comprehensive cross-creator report."""
    if not state["individual_analyses"]:
        return {"final_report": {"error": "No creators were analyzed successfully."}}

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=6000,
    )

    analyses_text = json.dumps(state["individual_analyses"], indent=2)

    prompt = REPORT_COMPILATION_PROMPT.format(
        niche=state["niche"],
        analyses_text=analyses_text[:12000],  # Token safety
    )

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        response_text = response.content
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start >= 0 and end > start:
            report = json.loads(response_text[start:end])
            report["creators"] = state["individual_analyses"]
            return {"final_report": report}
    except Exception as e:
        print(f"[creator_analyzer] Failed to compile report: {e}")

    return {"final_report": {
        "error": "Failed to compile report",
        "creators": state["individual_analyses"],
    }}


def build_creator_analyzer_graph() -> StateGraph:
    """Build the LangGraph graph for creator analysis."""
    graph = StateGraph(CreatorAnalysisState)

    graph.add_node("analyze_creators", analyze_single_creator)
    graph.add_node("compile_report", compile_report)

    graph.set_entry_point("analyze_creators")
    graph.add_edge("analyze_creators", "compile_report")
    graph.add_edge("compile_report", END)

    return graph.compile()


async def run_creator_analysis(
    niche: str,
    creator_profiles: list[dict],
) -> dict:
    """Run the full creator analysis pipeline.

    Args:
        niche: The niche/industry being analyzed
        creator_profiles: List of dicts with {name, public_identifier, headline, posts: [...]}

    Returns:
        The compiled report dict.
    """
    graph = build_creator_analyzer_graph()
    result = await graph.ainvoke({
        "niche": niche,
        "creator_profiles": creator_profiles,
        "individual_analyses": [],
        "final_report": {},
    })
    return result["final_report"]
