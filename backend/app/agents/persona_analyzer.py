"""LangGraph multi-pass agent for deep persona analysis of LinkedIn posts.

Pipeline:
  fetch_posts → chunk_posts → pass_1_writing_style → pass_2_thinking_patterns →
  pass_3_content_strategy → pass_4_linguistic_fingerprint → synthesize_report → store_report

Each pass processes ALL posts in batches and merges findings, producing an
extremely thorough persona report that replaces the need for embeddings/RAG.
"""

import json
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

from app.config import settings
from app.db import get_supabase


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

CHUNK_SIZE = 25  # posts per LLM call within a pass


def _get_llm(max_tokens: int = 4000) -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-4.1-mini",
        api_key=settings.OPENAI_API_KEY,
        max_tokens=max_tokens,
    )


def _format_posts_block(posts: list[dict], offset: int = 0) -> str:
    """Format a list of post dicts into a numbered text block."""
    text = ""
    for i, post in enumerate(posts, offset + 1):
        engagement = post.get("engagement") or {}
        likes = engagement.get("likes", 0)
        comments = engagement.get("comments", 0)
        text += f"\n--- Post {i} (Likes: {likes}, Comments: {comments}) ---\n"
        text += post["content"] + "\n"
    return text


async def _analyze_chunks(
    chunks: list[list[dict]],
    system_prompt: str,
    user_prompt_suffix: str,
    merge_prompt: str,
) -> str:
    """Run an analysis prompt across all post chunks, then merge results."""
    llm = _get_llm(max_tokens=4000)

    chunk_analyses: list[str] = []
    offset = 0
    for chunk in chunks:
        posts_block = _format_posts_block(chunk, offset)
        offset += len(chunk)

        message = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=posts_block + "\n\n" + user_prompt_suffix),
        ])
        chunk_analyses.append(message.content)

    # If only one chunk, no merge needed
    if len(chunk_analyses) == 1:
        return chunk_analyses[0]

    # Merge all chunk analyses into a single coherent analysis
    combined = "\n\n---\n\n".join(
        f"[Batch {i+1} Analysis]\n{a}" for i, a in enumerate(chunk_analyses)
    )
    merge_msg = await llm.ainvoke([
        SystemMessage(content="You are an expert analyst merging partial analyses into one comprehensive, deduplicated result."),
        HumanMessage(content=f"{merge_prompt}\n\nHere are the partial analyses:\n\n{combined}"),
    ])
    return merge_msg.content


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class PersonaAnalysisState(TypedDict):
    user_id: str
    raw_posts: list[dict]
    post_chunks: list[list[dict]]
    total_posts: int
    writing_style_analysis: str
    thinking_patterns: str
    content_strategy: str
    linguistic_fingerprint: str
    persona_report: dict
    analysis_stage: str  # for progress tracking


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

async def fetch_posts(state: PersonaAnalysisState) -> dict:
    """Load ALL scraped posts from the database."""
    db = get_supabase()

    result = (
        db.table("scraped_posts")
        .select("content, posted_at, engagement")
        .eq("user_id", state["user_id"])
        .order("posted_at", desc=True)
        .execute()
    )

    posts = result.data
    if not posts:
        raise ValueError("No scraped posts found. Run a scrape first.")

    return {"raw_posts": posts, "total_posts": len(posts), "analysis_stage": "fetched_posts"}


async def chunk_posts(state: PersonaAnalysisState) -> dict:
    """Split posts into chunks for batched analysis."""
    posts = state["raw_posts"]
    chunks = [posts[i : i + CHUNK_SIZE] for i in range(0, len(posts), CHUNK_SIZE)]
    return {"post_chunks": chunks, "analysis_stage": "chunked_posts"}


async def pass_1_writing_style(state: PersonaAnalysisState) -> dict:
    """Pass 1: Deep writing style analysis across all posts."""
    db = get_supabase()
    db.table("users").update({"scrape_status": "analyzing_style"}).eq("id", state["user_id"]).execute()

    system = """You are an expert linguistic analyst specializing in writing style forensics.
Analyze these LinkedIn posts from a single author and produce an EXHAUSTIVE writing style analysis.

Cover ALL of the following in extreme detail with specific examples and direct quotes:

1. SENTENCE STRUCTURE
   - Average sentence length and variation
   - Simple vs compound vs complex sentences
   - Fragment usage and intentional incomplete sentences
   - Paragraph/line break patterns

2. FORMATTING & VISUAL STYLE
   - Use of line breaks (single-line paragraphs? dense blocks?)
   - Emoji usage (which ones, frequency, placement)
   - Hashtag patterns (how many, where placed, style)
   - Use of bullet points, numbered lists, dashes
   - Capitalization patterns (ALL CAPS for emphasis? Title Case?)
   - Punctuation habits (ellipsis? em dashes? exclamation marks?)

3. POST ARCHITECTURE
   - How do they open posts? (hooks, questions, bold statements, stories)
   - How do they structure the middle? (narrative flow, list of points, dialogue)
   - How do they close? (CTA, question, reflection, one-liner)
   - Typical post length range
   - Common structural templates they reuse

4. HOOK PATTERNS
   - List their actual opening lines from the posts
   - Categorize the hook types they prefer
   - Note which hooks got highest engagement

Be extremely specific. Quote directly from the posts. Provide concrete patterns, not vague generalizations."""

    user_suffix = "Analyze these posts for writing style. Be exhaustive and quote specific examples."

    merge = "Merge these writing style analyses into one comprehensive analysis. Deduplicate findings, keep all specific quotes and examples, and identify the strongest patterns."

    analysis = await _analyze_chunks(state["post_chunks"], system, user_suffix, merge)
    return {"writing_style_analysis": analysis, "analysis_stage": "style_complete"}


async def pass_2_thinking_patterns(state: PersonaAnalysisState) -> dict:
    """Pass 2: Analyze how the author thinks, reasons, and forms opinions."""
    db = get_supabase()
    db.table("users").update({"scrape_status": "analyzing_thinking"}).eq("id", state["user_id"]).execute()

    system = """You are an expert psycholinguistic analyst. Analyze these LinkedIn posts to map the author's THINKING PATTERNS and WORLDVIEW.

Cover ALL of the following with specific evidence and direct quotes:

1. CORE BELIEFS & VALUES
   - What do they believe most strongly?
   - What principles guide their professional life?
   - What hills would they die on?

2. REASONING STYLE
   - Do they argue with data, stories, analogies, or authority?
   - Are they contrarian or consensus-seeking?
   - Do they use first-principles thinking or appeal to experience?
   - How do they handle nuance vs. taking hard stances?

3. MENTAL MODELS & FRAMEWORKS
   - What frameworks or mental models do they reference or implicitly use?
   - Do they categorize things? Use metaphors? Draw comparisons?
   - Recurring analogies or reference points

4. EMOTIONAL RANGE
   - What emotions surface in their writing? (passion, frustration, humor, vulnerability)
   - How do they express disagreement or criticism?
   - Do they show vulnerability or keep things professional?
   - When are they most animated vs. measured?

5. PERSPECTIVE & POSITIONING
   - How do they position themselves? (teacher, peer, challenger, storyteller)
   - Who do they implicitly write for?
   - What role do they assume in their industry?

Quote directly from posts. Map specific beliefs to specific posts."""

    user_suffix = "Analyze these posts for thinking patterns and worldview. Quote specific examples."

    merge = "Merge these thinking pattern analyses into one comprehensive analysis. Deduplicate, preserve all quotes, and identify the strongest patterns across all batches."

    analysis = await _analyze_chunks(state["post_chunks"], system, user_suffix, merge)
    return {"thinking_patterns": analysis, "analysis_stage": "thinking_complete"}


async def pass_3_content_strategy(state: PersonaAnalysisState) -> dict:
    """Pass 3: Analyze content strategy, topics, and what drives engagement."""
    db = get_supabase()
    db.table("users").update({"scrape_status": "analyzing_strategy"}).eq("id", state["user_id"]).execute()

    system = """You are an expert content strategist analyzing a LinkedIn creator's body of work.
Analyze these posts to extract their CONTENT STRATEGY and what drives engagement.

Cover ALL of the following with specific evidence:

1. TOPIC CLUSTERS
   - What are their main content pillars? (list each with frequency estimate)
   - What subtopics fall under each pillar?
   - Are there topics they've shifted toward or away from over time?

2. ENGAGEMENT PATTERNS
   - Which post types/topics get the highest likes and comments?
   - What structural patterns correlate with high engagement?
   - What hooks drive the most interaction?
   - What types of posts underperform?

3. AUDIENCE & POSITIONING
   - Who are they writing for? (job titles, seniority, industry)
   - What problems do they address for their audience?
   - How do they establish credibility?
   - What is their unique angle vs. other creators in their space?

4. CONTENT MIX
   - Ratio of educational vs. opinion vs. personal story vs. promotional
   - Do they share others' content or always original?
   - How do they reference their own work/products/services?

5. CALL-TO-ACTION PATTERNS
   - How do they drive engagement? (questions? polls? provocative takes?)
   - Do they ask for comments, shares, follows?
   - How subtle or direct are their CTAs?

Use engagement data (likes, comments) provided with each post to ground your analysis."""

    user_suffix = "Analyze these posts for content strategy patterns. Use engagement data to identify what works."

    merge = "Merge these content strategy analyses. Deduplicate topic clusters, combine engagement insights, and produce a unified content strategy breakdown."

    analysis = await _analyze_chunks(state["post_chunks"], system, user_suffix, merge)
    return {"content_strategy": analysis, "analysis_stage": "strategy_complete"}


async def pass_4_linguistic_fingerprint(state: PersonaAnalysisState) -> dict:
    """Pass 4: Extract the unique linguistic fingerprint — vocabulary, phrases, tone markers."""
    db = get_supabase()
    db.table("users").update({"scrape_status": "analyzing_language"}).eq("id", state["user_id"]).execute()

    system = """You are an expert forensic linguist creating a LINGUISTIC FINGERPRINT of this author.
Your job is to identify every distinctive language pattern that makes this person's writing uniquely theirs.

Cover ALL of the following with exhaustive examples:

1. SIGNATURE PHRASES & EXPRESSIONS
   - Words or phrases they use repeatedly (list every one you find)
   - Catch phrases or verbal tics
   - How they start sentences (favorite openings)
   - Transition words and connectors they prefer

2. VOCABULARY PROFILE
   - Words they use that most people wouldn't
   - Jargon or industry terms they favor
   - Simple vs. sophisticated word choices
   - Words they NEVER use (infer from consistent avoidance)

3. TONE MARKERS
   - How they express humor (sarcasm? self-deprecation? wit? dad jokes?)
   - How they show emphasis (caps? italics? repetition? short sentences?)
   - Level of formality (casual/professional/mixed)
   - Use of slang, colloquialisms, or internet language

4. RHETORICAL DEVICES
   - Do they use metaphors? Which kinds?
   - Repetition patterns (anaphora, epistrophe)
   - Questions (rhetorical? genuine? to open? to close?)
   - Storytelling techniques

5. VOICE DNA SUMMARY
   - If you had to describe this person's writing voice in 3 sentences, what would you say?
   - What makes their writing immediately recognizable?
   - What would sound "off" if a ghostwriter got it wrong?

Quote extensively. Every claim should have a direct example from the posts."""

    user_suffix = "Extract the complete linguistic fingerprint. Quote every distinctive pattern you find."

    merge = "Merge these linguistic fingerprint analyses into one definitive profile. Combine all signature phrases, deduplicate vocabulary lists, and produce the most complete fingerprint possible."

    analysis = await _analyze_chunks(state["post_chunks"], system, user_suffix, merge)
    return {"linguistic_fingerprint": analysis, "analysis_stage": "fingerprint_complete"}


async def synthesize_report(state: PersonaAnalysisState) -> dict:
    """Combine all 4 passes into a structured, comprehensive persona report."""
    db = get_supabase()
    db.table("users").update({"scrape_status": "synthesizing"}).eq("id", state["user_id"]).execute()

    llm = _get_llm(max_tokens=8000)

    synthesis_prompt = f"""You are synthesizing a comprehensive PERSONA REPORT from 4 deep-dive analyses of a LinkedIn creator's posts ({state['total_posts']} posts analyzed).

This report will be used by an AI ghostwriter to generate content that is INDISTINGUISHABLE from the original author. It must be extremely detailed and actionable.

## ANALYSIS INPUTS

### Writing Style Analysis
{state['writing_style_analysis']}

### Thinking Patterns & Worldview
{state['thinking_patterns']}

### Content Strategy
{state['content_strategy']}

### Linguistic Fingerprint
{state['linguistic_fingerprint']}

## YOUR TASK

Synthesize ALL of the above into a single JSON object with this exact structure:

{{
  "executive_summary": "2-3 paragraph summary of who this person is as a writer and thinker",

  "writing_style_guide": {{
    "sentence_patterns": "detailed description of how they construct sentences",
    "paragraph_structure": "how they break up text, use line breaks",
    "formatting_habits": "emoji, hashtag, capitalization, punctuation patterns",
    "post_length": "typical length range and variation",
    "post_templates": ["list of structural templates they reuse, described precisely"]
  }},

  "voice_dna": {{
    "tone": "precise tone description with nuance",
    "formality_level": "where they sit on the casual-formal spectrum",
    "humor_style": "how they use humor, if at all",
    "emphasis_techniques": "how they draw attention to key points",
    "signature_phrases": ["every distinctive phrase or expression they use repeatedly"],
    "vocabulary_preferences": ["words and terms they favor"],
    "words_to_avoid": ["words or styles they never use"],
    "rhetorical_devices": ["devices they commonly employ"]
  }},

  "thinking_profile": {{
    "core_beliefs": ["their strongest held beliefs and values"],
    "reasoning_style": "how they build arguments and make points",
    "mental_models": ["frameworks and mental models they use"],
    "emotional_range": "what emotions they show and how",
    "positioning": "how they position themselves (teacher, peer, challenger, etc.)",
    "strong_opinions": ["specific opinions or takes they've expressed"]
  }},

  "content_strategy": {{
    "topic_pillars": ["main topics they write about with frequency"],
    "high_engagement_patterns": "what types of posts get the most engagement and why",
    "audience": "who they write for",
    "content_mix": "ratio of educational/opinion/story/promotional",
    "cta_style": "how they drive engagement"
  }},

  "hook_patterns": {{
    "preferred_types": ["types of hooks they use most"],
    "example_hooks": ["actual opening lines from their posts, at least 10"],
    "highest_performing": ["hooks from their highest engagement posts"]
  }},

  "ghostwriting_rules": {{
    "must_do": ["specific things a ghostwriter MUST do to sound like this person"],
    "never_do": ["specific things a ghostwriter must NEVER do"],
    "quality_check": ["questions to ask yourself: 'Would they actually say this?'"]
  }},

  "personality_traits": ["inferred personality traits"],
  "industry_context": "their industry, role, and professional context"
}}

Return ONLY the JSON object. Make it extremely detailed and specific. Every field should contain actionable, concrete information — not vague generalizations. Include direct quotes where possible."""

    message = await llm.ainvoke([HumanMessage(content=synthesis_prompt)])

    response_text = message.content
    # Extract JSON from response
    start = response_text.find("{")
    end = response_text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"LLM did not return valid JSON. Raw response: {response_text[:500]}")

    persona_report = json.loads(response_text[start:end])
    return {"persona_report": persona_report, "analysis_stage": "synthesized"}


async def store_report(state: PersonaAnalysisState) -> dict:
    """Save the persona report to the users table."""
    db = get_supabase()
    db.table("users").update({
        "voice_profile": state["persona_report"],
        "scrape_status": "done",
    }).eq("id", state["user_id"]).execute()

    print(f"[persona] Stored persona report for user={state['user_id']} "
          f"({state['total_posts']} posts analyzed)")
    return {"analysis_stage": "done"}


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_persona_analyzer_graph():
    """Build the multi-pass LangGraph for comprehensive persona analysis."""
    graph = StateGraph(PersonaAnalysisState)

    graph.add_node("fetch_posts", fetch_posts)
    graph.add_node("chunk_posts", chunk_posts)
    graph.add_node("pass_1_writing_style", pass_1_writing_style)
    graph.add_node("pass_2_thinking_patterns", pass_2_thinking_patterns)
    graph.add_node("pass_3_content_strategy", pass_3_content_strategy)
    graph.add_node("pass_4_linguistic_fingerprint", pass_4_linguistic_fingerprint)
    graph.add_node("synthesize_report", synthesize_report)
    graph.add_node("store_report", store_report)

    graph.set_entry_point("fetch_posts")
    graph.add_edge("fetch_posts", "chunk_posts")
    graph.add_edge("chunk_posts", "pass_1_writing_style")
    graph.add_edge("pass_1_writing_style", "pass_2_thinking_patterns")
    graph.add_edge("pass_2_thinking_patterns", "pass_3_content_strategy")
    graph.add_edge("pass_3_content_strategy", "pass_4_linguistic_fingerprint")
    graph.add_edge("pass_4_linguistic_fingerprint", "synthesize_report")
    graph.add_edge("synthesize_report", "store_report")
    graph.add_edge("store_report", END)

    return graph.compile()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def build_voice_profile(user_id: str) -> dict:
    """Analyze all scraped posts and generate a comprehensive persona report.

    This is the main entry point, compatible with the existing service interface.
    """
    graph = build_persona_analyzer_graph()
    result = await graph.ainvoke({
        "user_id": user_id,
        "raw_posts": [],
        "post_chunks": [],
        "total_posts": 0,
        "writing_style_analysis": "",
        "thinking_patterns": "",
        "content_strategy": "",
        "linguistic_fingerprint": "",
        "persona_report": {},
        "analysis_stage": "starting",
    })
    return result["persona_report"]
