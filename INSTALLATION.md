# Installation Guide

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 10GB disk space

## Quick Installation

```bash
# 1. Extract archive
unzip deepweb-search-1.0.0.zip
cd deepweb-search

# 2. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start system
./start.sh
```

## Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8005
- API Documentation: http://localhost:8005/docs

## Common Commands

```bash
# View logs
docker-compose logs -f

# Stop system
docker-compose down

# Restart
docker-compose restart

# Full cleanup
docker-compose down -v
```

## Troubleshooting

### Port conflicts
If ports are in use, edit docker-compose.yml to change port mappings.

### Elasticsearch won't start
```bash
sudo sysctl -w vm.max_map_count=262144
```

### Database connection errors
```bash
docker-compose down -v
docker-compose up -d
```
