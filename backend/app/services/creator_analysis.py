"""Service for discovering top LinkedIn creators/orgs and orchestrating analysis.

Strategy: use the PROVEN post-search approach (same as commenter.py) to find posts
by niche keywords, then group by author to identify creators. This avoids the
unreliable people-search → user-posts endpoint chain.
"""

import traceback
from collections import defaultdict

import httpx
from app.config import settings
from app.db import get_supabase
from app.services.commenter import get_user_account_id
from app.agents.creator_analyzer import run_creator_analysis


# ---------------------------------------------------------------------------
# Low-level Unipile helpers
# ---------------------------------------------------------------------------

async def _search_posts_by_keyword(account_id: str, keyword: str, limit: int = 30) -> list[dict]:
    """Search LinkedIn for posts matching a keyword (proven to work)."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.UNIPILE_DSN}/api/v1/linkedin/search",
                headers={
                    "X-API-KEY": settings.UNIPILE_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "api": "classic",
                    "category": "posts",
                    "keywords": keyword,
                },
                params={"account_id": account_id},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data if isinstance(data, list) else data.get("items", [])
            print(f"[creator_analysis] Post search '{keyword}': {len(items)} results")
            return items
    except Exception as e:
        print(f"[creator_analysis] Post search failed for '{keyword}': {e}")
        return []


async def _resolve_user_profile(account_id: str, identifier: str) -> dict | None:
    """Resolve a LinkedIn public_identifier to a Unipile user profile with provider_id."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{settings.UNIPILE_DSN}/api/v1/users/{identifier}",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                params={"account_id": account_id},
            )
            resp.raise_for_status()
            profile = resp.json()
            print(f"[creator_analysis] Resolved '{identifier}' -> provider_id={profile.get('provider_id')}, name={profile.get('name')}")
            return profile
    except Exception as e:
        print(f"[creator_analysis] Failed to resolve user '{identifier}': {e}")
        return None


async def _fetch_posts_by_provider_id(account_id: str, provider_id: str, limit: int = 15) -> list[dict]:
    """Fetch a user's posts using their Unipile provider_id."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.UNIPILE_DSN}/api/v1/users/{provider_id}/posts",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                params={"account_id": account_id, "limit": limit},
            )
            resp.raise_for_status()
            data = resp.json()
            posts = data if isinstance(data, list) else data.get("items", [])
            print(f"[creator_analysis] Fetched {len(posts)} posts for provider_id={provider_id}")
            return posts
    except Exception as e:
        print(f"[creator_analysis] Failed to fetch posts for provider_id={provider_id}: {e}")
        return []


async def _search_company_posts(account_id: str, company_name: str, limit: int = 30) -> list[dict]:
    """Search LinkedIn for posts from/about a company."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.UNIPILE_DSN}/api/v1/linkedin/search",
                headers={
                    "X-API-KEY": settings.UNIPILE_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "api": "classic",
                    "category": "posts",
                    "keywords": company_name,
                },
                params={"account_id": account_id},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data if isinstance(data, list) else data.get("items", [])
            print(f"[creator_analysis] Company post search '{company_name}': {len(items)} results")
            return items
    except Exception as e:
        print(f"[creator_analysis] Company post search failed for '{company_name}': {e}")
        return []


# ---------------------------------------------------------------------------
# Higher-level discovery logic
# ---------------------------------------------------------------------------

def _group_posts_by_author(posts: list[dict], min_posts: int = 1) -> list[dict]:
    """Group a list of posts by author and return creator profiles."""
    author_posts: dict[str, dict] = defaultdict(lambda: {"name": "", "public_identifier": "", "headline": "", "posts": []})

    for post in posts:
        author = post.get("author") or {}
        author_id = author.get("public_identifier") or author.get("provider_id") or author.get("name", "")
        if not author_id:
            continue

        entry = author_posts[author_id]
        if not entry["name"]:
            entry["name"] = author.get("name", author_id)
        if not entry["public_identifier"]:
            entry["public_identifier"] = author.get("public_identifier", author_id)
        if not entry["headline"]:
            entry["headline"] = author.get("headline", "")
        entry["posts"].append(post)

    # Sort by post count descending, filter by min_posts
    creators = sorted(author_posts.values(), key=lambda c: len(c["posts"]), reverse=True)
    creators = [c for c in creators if len(c["posts"]) >= min_posts]
    print(f"[creator_analysis] Grouped into {len(creators)} creators (min_posts={min_posts})")
    return creators


async def _fetch_posts_for_url(account_id: str, url: str) -> dict | None:
    """Given a LinkedIn profile URL, resolve the user and fetch their posts."""
    # Extract identifier from URL: linkedin.com/in/username or linkedin.com/company/name
    identifier = url.strip().rstrip("/").split("/")[-1]
    if not identifier:
        return None

    print(f"[creator_analysis] Resolving URL -> identifier='{identifier}'")

    # Try to resolve user profile to get provider_id
    profile = await _resolve_user_profile(account_id, identifier)
    if profile:
        provider_id = profile.get("provider_id")
        if provider_id:
            posts = await _fetch_posts_by_provider_id(account_id, provider_id)
            if posts:
                return {
                    "name": profile.get("name", identifier),
                    "public_identifier": profile.get("public_identifier", identifier),
                    "headline": profile.get("headline", ""),
                    "posts": posts,
                }

    # Fallback: search for posts by the person's name or identifier
    print(f"[creator_analysis] Falling back to post search for '{identifier}'")
    search_name = profile.get("name", identifier) if profile else identifier
    posts = await _search_posts_by_keyword(account_id, search_name, limit=15)

    # Filter to posts by this specific author
    author_posts = []
    for post in posts:
        author = post.get("author") or {}
        pid = author.get("public_identifier", "")
        pname = author.get("name", "")
        if identifier.lower() in pid.lower() or identifier.lower() in pname.lower():
            author_posts.append(post)

    if author_posts:
        author = author_posts[0].get("author", {})
        return {
            "name": author.get("name", identifier),
            "public_identifier": author.get("public_identifier", identifier),
            "headline": author.get("headline", ""),
            "posts": author_posts,
        }

    return None


# ---------------------------------------------------------------------------
# Creator analysis pipeline
# ---------------------------------------------------------------------------

async def run_analysis_pipeline(user_id: str, report_id: str, niche: str | None = None, creator_urls: list[str] | None = None):
    """Full pipeline: search posts by niche → group by author → analyze → store report.

    This runs as a background task. Updates the creator_reports row as it progresses.
    When only creator_urls are provided (no niche), keyword search is skipped entirely.
    """
    db = get_supabase()

    try:
        db.table("creator_reports").update({"status": "running"}).eq("id", report_id).execute()
        print(f"[creator_analysis] Starting pipeline: niche='{niche}', urls={creator_urls}")

        account_id = await get_user_account_id(user_id)
        if not account_id:
            db.table("creator_reports").update({
                "status": "failed",
                "error_message": "LinkedIn account not connected",
            }).eq("id", report_id).execute()
            return

        print(f"[creator_analysis] Account ID: {account_id}")

        creator_profiles: list[dict] = []
        existing_ids: set[str] = set()

        # Step 1a: Handle explicit URLs
        if creator_urls:
            for url in creator_urls:
                if not url.strip():
                    continue
                profile = await _fetch_posts_for_url(account_id, url)
                if profile and profile["public_identifier"] not in existing_ids:
                    creator_profiles.append(profile)
                    existing_ids.add(profile["public_identifier"])
                    print(f"[creator_analysis] URL '{url}' -> creator '{profile['name']}' with {len(profile['posts'])} posts")
                else:
                    print(f"[creator_analysis] URL '{url}' -> no posts found")

        # Step 1b: Search posts by niche keywords and group by author
        # Only run keyword search when a niche is provided and we need more creators
        if niche and niche.strip() and len(creator_profiles) < 5:
            # Split niche into keywords for broader search
            keywords = [kw.strip() for kw in niche.replace(",", " ").split() if kw.strip()]
            # Also search the full phrase
            search_terms = [niche] + keywords[:3] if len(keywords) > 1 else [niche]

            all_posts: list[dict] = []
            seen_ids: set[str] = set()

            for term in search_terms:
                posts = await _search_posts_by_keyword(account_id, term, limit=30)
                for post in posts:
                    pid = post.get("id") or post.get("social_id", "")
                    if pid and pid not in seen_ids:
                        seen_ids.add(pid)
                        all_posts.append(post)

            print(f"[creator_analysis] Total unique posts found: {len(all_posts)}")

            # Group posts by author
            grouped = _group_posts_by_author(all_posts, min_posts=1)

            for creator in grouped:
                if creator["public_identifier"] in existing_ids:
                    continue
                creator_profiles.append(creator)
                existing_ids.add(creator["public_identifier"])
                if len(creator_profiles) >= 5:
                    break

        print(f"[creator_analysis] Total creator profiles: {len(creator_profiles)}")
        for cp in creator_profiles:
            print(f"  - {cp['name']} ({cp['public_identifier']}): {len(cp['posts'])} posts")

        if not creator_profiles:
            db.table("creator_reports").update({
                "status": "failed",
                "error_message": "Could not find any creators with posts. Try different URLs or add a niche keyword.",
            }).eq("id", report_id).execute()
            return

        # Update with creators found
        creators_summary = [
            {"name": c["name"], "public_identifier": c["public_identifier"], "headline": c.get("headline", ""), "post_count": len(c.get("posts", []))}
            for c in creator_profiles
        ]
        db.table("creator_reports").update({
            "creators_analyzed": creators_summary,
        }).eq("id", report_id).execute()

        # Step 2: Run the LangGraph analysis agent
        # Use a descriptive label when niche is not provided
        analysis_niche = niche if niche and niche.strip() else "LinkedIn Creator Analysis"
        print(f"[creator_analysis] Running LangGraph analysis for {len(creator_profiles)} creators...")
        report = await run_creator_analysis(analysis_niche, creator_profiles)

        # Step 3: Store the completed report
        db.table("creator_reports").update({
            "status": "completed",
            "report": report,
        }).eq("id", report_id).execute()
        print(f"[creator_analysis] Pipeline completed successfully for report {report_id}")

    except Exception as e:
        print(f"[creator_analysis] Pipeline FAILED: {e}")
        traceback.print_exc()
        db.table("creator_reports").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", report_id).execute()


# ---------------------------------------------------------------------------
# Competitor (organization) analysis pipeline
# ---------------------------------------------------------------------------

async def run_competitor_pipeline(user_id: str, report_id: str, competitors: list[str]):
    """Analyze competitor organizations: search their posts → analyze strategy → store report.

    This runs as a background task.
    """
    db = get_supabase()

    try:
        db.table("creator_reports").update({"status": "running"}).eq("id", report_id).execute()
        print(f"[competitor_analysis] Starting pipeline: competitors={competitors}")

        account_id = await get_user_account_id(user_id)
        if not account_id:
            db.table("creator_reports").update({
                "status": "failed",
                "error_message": "LinkedIn account not connected",
            }).eq("id", report_id).execute()
            return

        org_profiles: list[dict] = []

        for company in competitors:
            company = company.strip()
            if not company:
                continue

            print(f"[competitor_analysis] Searching posts for company: '{company}'")

            # Search for the company's posts
            posts = await _search_company_posts(account_id, company, limit=30)

            if not posts:
                print(f"[competitor_analysis] No posts found for '{company}'")
                continue

            # Try to separate the company's own posts from mentions
            company_posts = []
            mention_posts = []
            for post in posts:
                author = post.get("author") or {}
                author_name = (author.get("name") or "").lower()
                if company.lower() in author_name or author.get("is_company", False):
                    company_posts.append(post)
                else:
                    mention_posts.append(post)

            # Use company's own posts if available, otherwise all posts about them
            relevant_posts = company_posts if company_posts else posts[:15]

            org_profiles.append({
                "name": company,
                "public_identifier": company.lower().replace(" ", "-"),
                "headline": f"Organization: {company}",
                "posts": relevant_posts[:15],
                "is_company": True,
            })
            print(f"[competitor_analysis] '{company}': {len(relevant_posts)} posts ({len(company_posts)} own, {len(mention_posts)} mentions)")

        if not org_profiles:
            db.table("creator_reports").update({
                "status": "failed",
                "error_message": "Could not find any posts for the specified competitors.",
            }).eq("id", report_id).execute()
            return

        creators_summary = [
            {"name": c["name"], "public_identifier": c["public_identifier"], "headline": c.get("headline", ""), "post_count": len(c.get("posts", []))}
            for c in org_profiles
        ]
        db.table("creator_reports").update({
            "creators_analyzed": creators_summary,
        }).eq("id", report_id).execute()

        # Use the same analysis agent but with "competitor" framing
        niche_label = ", ".join(competitors)
        print(f"[competitor_analysis] Running analysis agent for {len(org_profiles)} competitors...")
        report = await run_creator_analysis(f"Competitor analysis: {niche_label}", org_profiles)

        db.table("creator_reports").update({
            "status": "completed",
            "report": report,
        }).eq("id", report_id).execute()
        print(f"[competitor_analysis] Pipeline completed for report {report_id}")

    except Exception as e:
        print(f"[competitor_analysis] Pipeline FAILED: {e}")
        traceback.print_exc()
        db.table("creator_reports").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", report_id).execute()
