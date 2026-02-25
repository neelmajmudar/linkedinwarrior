from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.scheduler import start_scheduler, stop_scheduler
from app.routes import scrape, persona, content, linkedin, analytics, engagement, creator_analysis, tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="ImagineAI Content Engine",
    description="AI-powered LinkedIn content generation with persona-based voice replication",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scrape.router)
app.include_router(persona.router)
app.include_router(content.router)
app.include_router(linkedin.router)
app.include_router(analytics.router)
app.include_router(engagement.router)
app.include_router(creator_analysis.router)
app.include_router(tasks.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
