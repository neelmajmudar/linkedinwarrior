from pydantic import BaseModel, Field
from typing import Generic, List, Optional, TypeVar
from datetime import datetime
from enum import Enum

T = TypeVar("T")


class ContentStatus(str, Enum):
    draft = "draft"
    approved = "approved"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    failed = "failed"


class ScrapeStatus(str, Enum):
    pending = "pending"
    running = "running"
    done = "done"
    error = "error"


# --- Request models ---

class ScrapeRequest(BaseModel):
    linkedin_username: str = Field(..., min_length=1, description="LinkedIn public identifier e.g. 'williamhgates'")
    max_posts: int = Field(default=200, ge=1, le=1000)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Topic or idea for the post")


class UpdateContentRequest(BaseModel):
    body: Optional[str] = None
    status: Optional[ContentStatus] = None
    scheduled_at: Optional[datetime] = None


class ScheduleRequest(BaseModel):
    scheduled_at: datetime


class LinkedInConnectRequest(BaseModel):
    """Empty for now — backend generates the Unipile auth URL."""
    pass


# --- Response models ---

class UserProfile(BaseModel):
    id: str
    linkedin_username: Optional[str] = None
    voice_profile: Optional[dict] = None
    scrape_status: Optional[str] = None
    last_scraped_at: Optional[str] = None


class ScrapeStatusResponse(BaseModel):
    scrape_status: str
    posts_count: int = 0
    embeddings_count: int = 0


class ContentItem(BaseModel):
    id: str
    prompt: Optional[str] = None
    body: str
    status: str
    scheduled_at: Optional[str] = None
    published_at: Optional[str] = None
    linkedin_post_id: Optional[str] = None
    engagement: Optional[dict] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class LinkedInStatus(BaseModel):
    connected: bool


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    has_next: bool


# --- Email models ---

class GmailStatus(BaseModel):
    connected: bool
    email_address: Optional[str] = None


class EmailActionItem(BaseModel):
    item: str
    due: Optional[str] = None
    priority: str = "medium"


class EmailItem(BaseModel):
    id: str
    from_name: Optional[str] = None
    from_email: str
    to_email: Optional[str] = None
    subject: Optional[str] = None
    category: Optional[str] = None
    action_items: Optional[List[EmailActionItem]] = None
    priority: Optional[str] = None
    status: str
    auto_reply_eligible: bool = False
    has_attachments: bool = False
    received_at: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class EmailDraft(BaseModel):
    id: str
    email_id: str
    subject: Optional[str] = None
    body: str
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class EmailDetailResponse(BaseModel):
    id: str
    from_name: Optional[str] = None
    from_email: str
    to_email: Optional[str] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    category: Optional[str] = None
    action_items: Optional[List[EmailActionItem]] = None
    priority: Optional[str] = None
    status: str
    auto_reply_eligible: bool = False
    has_attachments: bool = False
    received_at: Optional[str] = None
    draft: Optional[EmailDraft] = None

    model_config = {"from_attributes": True}


class EditDraftRequest(BaseModel):
    body: Optional[str] = None
    subject: Optional[str] = None


class AutoSendPreferences(BaseModel):
    categories: List[str] = []
