"""Routes for the Creator Analysis and Competitor Research features."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.db import get_supabase
from app.services.creator_analysis import run_analysis_pipeline, run_competitor_pipeline
from app.task_manager import create_task, TaskType

router = APIRouter(prefix="/api/creator-analysis", tags=["creator-analysis"])


class RunAnalysisRequest(BaseModel):
    niche: str = Field(..., min_length=2, max_length=200)
    creator_urls: Optional[list[str]] = None


class RunCompetitorRequest(BaseModel):
    competitors: list[str] = Field(..., min_length=1)


@router.post("/run")
async def start_analysis(
    payload: RunAnalysisRequest,
    user: dict = Depends(get_current_user),
):
    """Start a creator analysis. Creates a report row and kicks off background processing."""
    db = get_supabase()

    row = db.table("creator_reports").insert({
        "user_id": user["id"],
        "niche": payload.niche,
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
        meta={"report_id": report_id, "niche": payload.niche},
    )

    return {"report_id": report_id, "status": "pending"}


@router.post("/competitor")
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
    limit: int = 10,
    user: dict = Depends(get_current_user),
):
    """List the user's past creator analysis reports."""
    db = get_supabase()
    result = db.table("creator_reports") \
        .select("id, niche, creators_analyzed, status, error_message, created_at") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    return {"reports": result.data or []}


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
