# LinkedIn Warrior Backend - Production Deployment

## Prerequisites

- Docker and Docker Compose installed
- `.env` file configured with production credentials

## Quick Start

### Windows (PowerShell)
```powershell
.\start-prod.ps1
```

### Linux/Mac
```bash
chmod +x start-prod.sh
./start-prod.sh
```

## Manual Deployment

### 1. Configure Environment
```bash
cp .env.example .env
# Edit .env with your production credentials
```

### 2. Build and Start
```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Verify Deployment
```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Test health endpoint
curl http://localhost:8000/health
```

## Production Services

The production build includes:

- **Backend API** (Port 8000): FastAPI application with 4 workers
- **Redis** (Port 6379): Message broker for Celery
- **Celery Worker**: Background task processing

## Management Commands

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Restart Services
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Stop Services
```bash
docker-compose -f docker-compose.prod.yml down
```

### Stop and Remove Volumes
```bash
docker-compose -f docker-compose.prod.yml down -v
```

### Scale Workers
```bash
docker-compose -f docker-compose.prod.yml up -d --scale celery-worker=3
```

## Environment Variables

Required environment variables in `.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key

# API Keys
APIFY_API_TOKEN=your_apify_token
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
UNIPILE_API_KEY=your_unipile_key

# Redis
REDIS_URL=redis://redis:6379/0

# Frontend
FRONTEND_URL=https://your-frontend-domain.com
```

## Health Checks

The backend includes automatic health checks:

- **Endpoint**: `GET /health`
- **Interval**: Every 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

## Security Notes

1. Never commit `.env` file to version control
2. Use strong, unique API keys in production
3. Configure firewall rules to restrict access
4. Enable HTTPS in production (use reverse proxy like Nginx)
5. Regularly update dependencies

## Monitoring

### Check Container Health
```bash
docker ps
```

### Monitor Resource Usage
```bash
docker stats
```

### Access Container Shell
```bash
docker exec -it linkedinwarrior-backend /bin/bash
```

## Troubleshooting

### Services won't start
```bash
# Check logs for errors
docker-compose -f docker-compose.prod.yml logs

# Rebuild from scratch
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Database connection issues
- Verify Supabase credentials in `.env`
- Check network connectivity
- Ensure Supabase project is active

### Redis connection issues
```bash
# Test Redis connection
docker exec -it linkedinwarrior-redis redis-cli ping
```

## Performance Tuning

### Adjust Worker Count
Edit `Dockerfile` CMD line:
```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "8"]
```

### Scale Celery Workers
```bash
docker-compose -f docker-compose.prod.yml up -d --scale celery-worker=5
```

## Backup and Recovery

### Backup Redis Data
```bash
docker exec linkedinwarrior-redis redis-cli BGSAVE
docker cp linkedinwarrior-redis:/data/dump.rdb ./backup/
```

### Restore Redis Data
```bash
docker cp ./backup/dump.rdb linkedinwarrior-redis:/data/
docker-compose -f docker-compose.prod.yml restart redis
```
