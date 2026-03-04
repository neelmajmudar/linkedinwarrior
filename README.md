# LinkedInWarrior — AI-Powered LinkedIn Content Engine

Generate LinkedIn posts in your authentic voice. Scrapes your past posts via Apify, builds a persona with embeddings + LLM analysis, then generates new content you can review, edit, schedule, and publish via Unipile. **Now with multi-tenant team collaboration** — invite team members, manage roles, and collaborate on content calendars.

## Architecture

```
Frontend (Next.js) → Backend (FastAPI) → Apify (scrape) + Supabase/pgvector (store/embed) + OpenAI GPT-4.1-mini (generate) + Unipile (publish)
                  ↓
    Supabase Edge Functions (low-latency reads) + Realtime (live updates)
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
7. **Teams** (optional) — create organizations, invite team members with roles (owner/admin/editor/viewer), collaborate on shared content calendars with real-time updates

## Teams & Collaboration

LinkedInWarrior supports multi-tenant organizations with role-based access control:

- **Roles**: Owner > Admin > Editor > Viewer
- **Permissions**:
  - **Owners**: Full control (manage settings, delete org, manage all members)
  - **Admins**: Manage members, edit all org content
  - **Editors**: Create and edit all org content
  - **Viewers**: Read-only access to org content
- **Features**:
  - Email invitations with secure token-based acceptance
  - Team calendar with color-coded member posts
  - Real-time updates via Supabase Realtime
  - Conflict detection for scheduled posts (time proximity + topic similarity)
  - Member filtering and role management

## API Endpoints

### Core Features

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
| POST   | `/api/content/:id/image`    | Upload image for post         |
| POST   | `/api/content/:id/publish`  | Publish to LinkedIn           |
| POST   | `/api/content/:id/schedule` | Schedule for later            |
| POST   | `/api/linkedin/connect`     | Get Unipile auth URL          |
| POST   | `/api/linkedin/callback`    | Handle auth callback          |
| GET    | `/api/linkedin/status`      | Check connection              |
| GET    | `/api/analytics`            | Aggregate stats               |
| GET    | `/health`                   | Health check                  |

### Organizations & Teams

| Method | Path                                    | Description                      |
| ------ | --------------------------------------- | -------------------------------- |
| GET    | `/api/orgs`                             | List user's organizations        |
| POST   | `/api/orgs`                             | Create new organization          |
| POST   | `/api/orgs/accept-invite`               | Accept org invitation            |
| POST   | `/api/orgs/switch-personal`             | Switch to personal context       |
| GET    | `/api/orgs/:id`                         | Get org details + members        |
| PATCH  | `/api/orgs/:id`                         | Update org settings              |
| DELETE | `/api/orgs/:id`                         | Delete organization (owner only) |
| POST   | `/api/orgs/:id/switch`                  | Switch to org context            |
| POST   | `/api/orgs/:id/invite`                  | Invite member via email          |
| PATCH  | `/api/orgs/:id/members/:userId`         | Update member role               |
| DELETE | `/api/orgs/:id/members/:userId`         | Remove member                    |
| POST   | `/api/orgs/:id/content/check-conflicts` | Check for scheduling conflicts   |

## Tech Stack

- **Frontend**: Next.js 14, TailwindCSS, Lucide icons, TanStack Query, Supabase Realtime
- **Backend**: FastAPI, Pydantic v2, APScheduler, LangGraph agents
- **Database**: Supabase (Postgres + pgvector + Auth + RLS + Realtime)
- **Edge Functions**: Supabase Edge Functions (Deno) for low-latency reads
- **AI**: OpenAI GPT-4.1-mini (generation), OpenAI text-embedding-3-small (embeddings), Claude 3.5 Sonnet (persona analysis)
- **LinkedIn Scraping**: Apify `harvestapi/linkedin-profile-posts`
- **LinkedIn Posting**: Unipile REST API
- **Email**: Resend for transactional emails (org invitations)

## Environment Variables

### Backend (`.env`)

| Variable               | Description                              |
| ---------------------- | ---------------------------------------- |
| `SUPABASE_URL`         | Supabase project URL                     |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (backend only) |
| `APIFY_API_TOKEN`      | Apify API token                          |
| `ANTHROPIC_API_KEY`    | Anthropic API key (for persona analysis) |
| `OPENAI_API_KEY`       | OpenAI API key (for generation)          |
| `UNIPILE_DSN`          | Unipile API base URL                     |
| `UNIPILE_API_KEY`      | Unipile API key                          |
| `RESEND_API_KEY`       | Resend API key (for invite emails)       |
| `FRONTEND_URL`         | Frontend URL for CORS                    |

### Frontend (`.env.local`)

| Variable                        | Description          |
| ------------------------------- | -------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key    |
| `NEXT_PUBLIC_API_URL`           | Backend API URL      |

## Recent Updates

### Multi-Tenant Teams Feature (v2.0)

- ✅ Full organization management with role-based access control
- ✅ Email invitations with secure token-based acceptance flow
- ✅ Team calendar with color-coded member posts and filtering
- ✅ Real-time collaboration via Supabase Realtime subscriptions
- ✅ Conflict detection for scheduled posts (time + topic similarity)
- ✅ Org-scoped content permissions and RLS policies

### Bug Fixes & Improvements

- 🐛 Fixed route ordering issues (`switch-personal`, `accept-invite`)
- 🐛 Fixed content access control for org admins/owners/editors
- 🐛 Fixed calendar edit permissions for team members
- 🐛 Fixed accept-invite race condition with duplicate member handling
- 🐛 Fixed React Strict Mode double-fire on invite acceptance
- 🐛 Fixed voice profile banner flash on hard refresh
- ⚡ Improved content access with unified `_verify_content_access` helper
- ⚡ Edge function fallback for 401 errors with automatic backend retry

## Database Migrations

Run migrations in order:

1. `001_initial_schema.sql` — Core tables and RLS
2. `002_auto_comments.sql` — Auto-commenting feature
3. `003_image_support.sql` — Image upload support
4. `004_gmail_integration.sql` — Gmail integration
5. `005_creator_analysis.sql` — Creator analysis
6. `006_email_assistant.sql` — Email assistant
7. `010_organizations.sql` — Multi-tenant organizations

## License

MIT
