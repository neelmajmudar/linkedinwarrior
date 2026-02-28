"""Routes for the Creator Analysis and Competitor Research features."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.db import get_supabase
from app.services.creator_analysis import run_analysis_pipeline, run_competitor_pipeline
from app.task_manager import create_task, TaskType
from app.rate_limit import rate_limit

router = APIRouter(prefix="/api/creator-analysis", tags=["creator-analysis"])


class RunAnalysisRequest(BaseModel):
    niche: Optional[str] = Field(None, max_length=200)
    creator_urls: Optional[list[str]] = None


class RunCompetitorRequest(BaseModel):
    competitors: list[str] = Field(..., min_length=1)


@router.post("/run", dependencies=[Depends(rate_limit("research", 10, 3600))])
async def start_analysis(
    payload: RunAnalysisRequest,
    user: dict = Depends(get_current_user),
):
    """Start a creator analysis. Creates a report row and kicks off background processing."""
    has_niche = payload.niche and payload.niche.strip()
    has_urls = payload.creator_urls and len(payload.creator_urls) > 0
    if not has_niche and not has_urls:
        raise HTTPException(status_code=422, detail="Provide a niche/keywords or at least one creator URL.")

    # When only URLs are given, derive a display label from them
    niche_label = payload.niche.strip() if has_niche else "Creators: " + ", ".join(
        url.strip().rstrip("/").split("/")[-1] for url in (payload.creator_urls or []) if url.strip()
    )

    db = get_supabase()

    row = db.table("creator_reports").insert({
        "user_id": user["id"],
        "niche": niche_label,
        "creator_urls": payload.creator_urls or [],
        "status": "pending",
    }).execute()

    if not row.data:
        raise HTTPException(status_code=500, detail="Failed to create report")

    report_id = row.data[0]["id"]

    create_task(
        user_id=user["id"],
        task_type=TaskType.research,
        coro=run_analysis_pipeline(
            user_id=user["id"],
            report_id=report_id,
            niche=payload.niche,
            creator_urls=payload.creator_urls,
        ),
        meta={"report_id": report_id, "niche": niche_label},
    )

    return {"report_id": report_id, "status": "pending"}


@router.post("/competitor", dependencies=[Depends(rate_limit("research", 10, 3600))])
async def start_competitor_analysis(
    payload: RunCompetitorRequest,
    user: dict = Depends(get_current_user),
):
    """Start a competitor/organization analysis."""
    db = get_supabase()

    niche_label = f"Competitor: {', '.join(payload.competitors)}"
    row = db.table("creator_reports").insert({
        "user_id": user["id"],
        "niche": niche_label,
        "creator_urls": [],
        "status": "pending",
    }).execute()

    if not row.data:
        raise HTTPException(status_code=500, detail="Failed to create report")

    report_id = row.data[0]["id"]

    create_task(
        user_id=user["id"],
        task_type=TaskType.research,
        coro=run_competitor_pipeline(
            user_id=user["id"],
            report_id=report_id,
            competitors=payload.competitors,
        ),
        meta={"report_id": report_id, "niche": niche_label},
    )

    return {"report_id": report_id, "status": "pending"}


@router.get("/reports")
async def list_reports(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    user: dict = Depends(get_current_user),
):
    """List the user's past creator analysis reports."""
    db = get_supabase()
    offset = (page - 1) * page_size

    count_result = db.table("creator_reports").select("id", count="exact").eq("user_id", user["id"]).execute()
    total = count_result.count or 0

    data_result = db.table("creator_reports") \
        .select("id, niche, creators_analyzed, status, error_message, created_at") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .range(offset, offset + page_size - 1) \
        .execute()

    return {
        "reports": data_result.data or [],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (offset + page_size) < total,
    }


@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a specific creator analysis report."""
    db = get_supabase()
    result = db.table("creator_reports") \
        .select("*") \
        .eq("id", report_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")

    return result.data[0]


@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a creator analysis report."""
    db = get_supabase()
    result = db.table("creator_reports") \
        .select("id") \
        .eq("id", report_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")

    db.table("creator_reports").delete().eq("id", report_id).execute()
    return {"status": "deleted"}
