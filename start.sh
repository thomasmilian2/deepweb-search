#!/bin/bash

echo "🚀 Starting DeepWeb Search System..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not installed"
    exit 1
fi

echo "✅ Prerequisites OK"
echo "🏗️  Building containers..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services..."
sleep 15

echo ""
echo "✅ System started!"
echo ""
echo "📡 Services:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8005"
echo "   - API Docs: http://localhost:8005/docs"
echo ""
echo "🔍 Logs: docker-compose logs -f"
echo "🛑 Stop: docker-compose down"
