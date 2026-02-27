# Production startup script for LinkedIn Warrior Backend (PowerShell)

Write-Host "🚀 Starting LinkedIn Warrior Backend (Production Mode)" -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path .env)) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure your environment variables." -ForegroundColor Yellow
    exit 1
}

# Build and start services
Write-Host "📦 Building Docker images..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml build

Write-Host "🔄 Starting services..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml up -d

Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service health
Write-Host "🏥 Checking service health..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml ps

Write-Host ""
Write-Host "✅ Production build started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Service URLs:" -ForegroundColor Cyan
Write-Host "   - Backend API: http://localhost:8000"
Write-Host "   - API Docs: http://localhost:8000/docs"
Write-Host "   - Health Check: http://localhost:8000/health"
Write-Host "   - Redis: localhost:6379"
Write-Host ""
Write-Host "📝 Useful commands:" -ForegroundColor Cyan
Write-Host "   - View logs: docker-compose -f docker-compose.prod.yml logs -f"
Write-Host "   - Stop services: docker-compose -f docker-compose.prod.yml down"
Write-Host "   - Restart services: docker-compose -f docker-compose.prod.yml restart"
Write-Host ""
