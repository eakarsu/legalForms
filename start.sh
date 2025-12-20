#!/bin/bash

# ========================================
# Legal Forms Generator - Startup Script
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Legal Forms Generator - Startup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo -e "${GREEN}✓${NC} Loaded environment variables from .env"
else
    echo -e "${RED}✗${NC} .env file not found!"
    exit 1
fi

# Default port
PORT=${PORT:-3000}

# ========================================
# Step 1: Clean used ports
# ========================================
echo ""
echo -e "${YELLOW}Step 1: Cleaning port $PORT...${NC}"

# Find and kill any process using the port
PID=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$PID" ]; then
    echo -e "  Found process(es) using port $PORT: $PID"
    kill -9 $PID 2>/dev/null || true
    sleep 1
    echo -e "  ${GREEN}✓${NC} Killed process(es) on port $PORT"
else
    echo -e "  ${GREEN}✓${NC} Port $PORT is available"
fi

# ========================================
# Step 2: Check PostgreSQL connection
# ========================================
echo ""
echo -e "${YELLOW}Step 2: Checking PostgreSQL connection...${NC}"

# Extract database connection details from DATABASE_URL or individual vars
if [ -n "$DATABASE_URL" ]; then
    # Parse DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
else
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-legalforms}
fi

echo -e "  Database: $DB_NAME @ $DB_HOST:$DB_PORT"

# Check if PostgreSQL is running
if command -v pg_isready &> /dev/null; then
    if pg_isready -h $DB_HOST -p $DB_PORT -q; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL is running"
    else
        echo -e "  ${RED}✗${NC} PostgreSQL is not running!"
        echo -e "  ${YELLOW}Please start PostgreSQL manually and try again.${NC}"
        echo ""
        echo "  On macOS with Homebrew:"
        echo "    brew services start postgresql"
        echo ""
        echo "  On macOS with Postgres.app:"
        echo "    Open Postgres.app"
        echo ""
        exit 1
    fi
else
    # Try connecting with psql as fallback
    if psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "SELECT 1" &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL connection successful"
    else
        echo -e "  ${YELLOW}!${NC} Could not verify PostgreSQL status (pg_isready not found)"
        echo -e "  ${YELLOW}  Assuming PostgreSQL is running...${NC}"
    fi
fi

# Test actual database connection
echo -e "  Testing database connection..."
if node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}' });
pool.query('SELECT NOW()').then(() => {
    console.log('  Connected successfully');
    pool.end();
    process.exit(0);
}).catch(err => {
    console.error('  Connection failed:', err.message);
    pool.end();
    process.exit(1);
});
" 2>&1; then
    echo -e "  ${GREEN}✓${NC} Database connection verified"
else
    echo -e "  ${RED}✗${NC} Could not connect to database!"
    exit 1
fi

# ========================================
# Step 3: Check dependencies
# ========================================
echo ""
echo -e "${YELLOW}Step 3: Checking dependencies...${NC}"

if [ ! -d "node_modules" ]; then
    echo -e "  Installing dependencies..."
    npm install
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
else
    echo -e "  ${GREEN}✓${NC} Dependencies already installed"
fi

# ========================================
# Step 4: Run build validation
# ========================================
echo ""
echo -e "${YELLOW}Step 4: Running build validation...${NC}"

if npm run build --silent; then
    echo -e "  ${GREEN}✓${NC} Build validation passed"
else
    echo -e "  ${RED}✗${NC} Build validation failed!"
    exit 1
fi

# ========================================
# Step 5: Start the application
# ========================================
echo ""
echo -e "${YELLOW}Step 5: Starting application...${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Server starting on port $PORT${NC}"
echo -e "${GREEN}  http://localhost:$PORT${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Start the server
npm start
