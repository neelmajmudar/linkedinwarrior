# LinkedInWarrior — AI-Powered LinkedIn Content Engine

Generate LinkedIn posts in your authentic voice. Scrapes your past posts via Apify, builds a persona with embeddings + LLM analysis, then generates new content you can review, edit, schedule, and publish via Unipile.

## Architecture

```
Frontend (Next.js) → Backend (FastAPI) → Apify (scrape) + Supabase/pgvector (store/embed) + OpenAI GPT-5-mini (generate) + Unipile (publish)
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project with pgvector enabled
- API keys: Apify, Anthropic, OpenAI, Unipile

### 1. Database Setup

Run the migration in your Supabase SQL editor:

```sql
-- Copy contents of supabase/migrations/001_initial_schema.sql
```

This creates tables (`users`, `scraped_posts`, `post_embeddings`, `content_items`), RLS policies, and the `match_posts` vector similarity function.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your API keys in .env

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL

npm install
npm run dev
```

Open http://localhost:3000

## User Flow

1. **Sign up** — creates a Supabase Auth account
2. **Onboarding** — enter your LinkedIn username → Apify scrapes your posts → embeddings stored in pgvector → Claude builds your voice profile
3. **Generate** — type a topic → AI writes a draft in your voice via RAG + streaming
4. **Edit** — review and freely edit the draft in a rich text editor
5. **Publish** — post immediately or schedule for later via Unipile
6. **Calendar** — view all scheduled and published posts on a monthly calendar

## API Endpoints

| Method | Path                        | Description                   |
| ------ | --------------------------- | ----------------------------- |
| POST   | `/api/scrape`               | Trigger Apify scrape pipeline |
| GET    | `/api/scrape/status`        | Poll scrape progress          |
| GET    | `/api/persona`              | Get voice profile             |
| POST   | `/api/persona/rebuild`      | Rebuild voice profile         |
| POST   | `/api/content/generate`     | Generate post (SSE stream)    |
| GET    | `/api/content`              | List content items            |
| GET    | `/api/content/:id`          | Get single item               |
| PATCH  | `/api/content/:id`          | Update draft                  |
| DELETE | `/api/content/:id`          | Delete draft                  |
| POST   | `/api/content/:id/publish`  | Publish to LinkedIn           |
| POST   | `/api/content/:id/schedule` | Schedule for later            |
| POST   | `/api/linkedin/connect`     | Get Unipile auth URL          |
| POST   | `/api/linkedin/callback`    | Handle auth callback          |
| GET    | `/api/linkedin/status`      | Check connection              |
| GET    | `/api/analytics`            | Aggregate stats               |
| GET    | `/health`                   | Health check                  |

## Tech Stack

- **Frontend**: Next.js 14, TailwindCSS, Lucide icons
- **Backend**: FastAPI, Pydantic v2, APScheduler
- **Database**: Supabase (Postgres + pgvector + Auth + RLS)
- **AI**: Anthropic Claude 3.5 Sonnet (generation), OpenAI text-embedding-3-small (embeddings)
- **LinkedIn Scraping**: Apify `harvestapi/linkedin-profile-posts`
- **LinkedIn Posting**: Unipile REST API

## Environment Variables

### Backend (`.env`)

| Variable               | Description                              |
| ---------------------- | ---------------------------------------- |
| `SUPABASE_URL`         | Supabase project URL                     |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (backend only) |
| `APIFY_API_TOKEN`      | Apify API token                          |
| `ANTHROPIC_API_KEY`    | Anthropic API key                        |
| `OPENAI_API_KEY`       | OpenAI API key                           |
| `UNIPILE_DSN`          | Unipile API base URL                     |
| `UNIPILE_API_KEY`      | Unipile API key                          |
| `FRONTEND_URL`         | Frontend URL for CORS                    |

### Frontend (`.env.local`)

| Variable                        | Description          |
| ------------------------------- | -------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key    |
| `NEXT_PUBLIC_API_URL`           | Backend API URL      |
