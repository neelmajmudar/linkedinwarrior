#!/bin/bash

# Production startup script for LinkedIn Warrior Backend

echo "🚀 Starting LinkedIn Warrior Backend (Production Mode)"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and configure your environment variables."
    exit 1
fi

# Build and start services
echo "📦 Building Docker images..."
docker-compose -f docker-compose.prod.yml build

echo "🔄 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "✅ Production build started successfully!"
echo ""
echo "📊 Service URLs:"
echo "   - Backend API: http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"
echo "   - Health Check: http://localhost:8000/health"
echo "   - Redis: localhost:6379"
echo ""
echo "📝 Useful commands:"
echo "   - View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   - Stop services: docker-compose -f docker-compose.prod.yml down"
echo "   - Restart services: docker-compose -f docker-compose.prod.yml restart"
echo ""
