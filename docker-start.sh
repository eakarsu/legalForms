#!/bin/bash

# ========================================
# Docker Start Script for LegalForms
# ========================================

echo "Stopping any existing containers and freeing port 3000..."

# Stop all running docker containers
docker ps -q | xargs -r docker stop 2>/dev/null

# Kill any process using port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

sleep 1

echo "Starting LegalForms container..."

docker run -p 3000:3000 --env-file .env.docker legalforms
