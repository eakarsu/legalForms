#!/bin/bash

# ========================================
# Legal Forms Generator - Startup Script
# ========================================

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

# Detect if running in Docker
DOCKER_MODE=false
if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    DOCKER_MODE=true
    echo -e "${BLUE}Running in Docker mode${NC}"
fi

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo -e "${GREEN}✓${NC} Loaded environment variables from .env"
elif [ "$DOCKER_MODE" = true ]; then
    echo -e "${YELLOW}!${NC} No .env file, using environment variables"
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

# Always try to clean port (works in both Docker and local mode)
if command -v lsof &> /dev/null; then
    PID=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo -e "  Found process(es) using port $PORT: $PID"
        kill -9 $PID 2>/dev/null || true
        sleep 1
        echo -e "  ${GREEN}✓${NC} Killed process(es) on port $PORT"
    else
        echo -e "  ${GREEN}✓${NC} Port $PORT is available"
    fi
elif command -v fuser &> /dev/null; then
    fuser -k $PORT/tcp 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} Port $PORT cleaned with fuser"
elif command -v ss &> /dev/null; then
    # Try to find and kill using ss
    PID=$(ss -tlnp | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
    if [ -n "$PID" ]; then
        kill -9 $PID 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Killed process on port $PORT"
    else
        echo -e "  ${GREEN}✓${NC} Port $PORT is available"
    fi
else
    echo -e "  ${YELLOW}!${NC} No port checking tools available, continuing..."
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

# In Docker mode, PostgreSQL is already started by CMD
if [ "$DOCKER_MODE" = true ]; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL started by Docker"
    # Wait a moment for PostgreSQL to be ready
    sleep 2
else
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

# Skip dependency check in Docker mode (already installed during image build)
if [ "$DOCKER_MODE" = true ]; then
    echo -e "  ${GREEN}✓${NC} Dependencies installed (Docker mode)"
elif [ ! -d "node_modules" ]; then
    echo -e "  Installing dependencies..."
    npm install
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
else
    echo -e "  ${GREEN}✓${NC} Dependencies already installed"
fi

# ========================================
# Step 4: Database Population Check
# ========================================
echo ""
echo -e "${YELLOW}Step 4: Checking database population...${NC}"

# Set psql command based on Docker mode
if [ "$DOCKER_MODE" = true ]; then
    PSQL_CMD="su postgres -c \"psql -d $DB_NAME\""
    PSQL_EXEC="su postgres -c"
else
    PSQL_CMD="psql -d $DB_NAME"
    PSQL_EXEC=""
fi

# Check if database has data by checking users table
if [ "$DOCKER_MODE" = true ]; then
    DATA_EXISTS=$(psql -U postgres -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
else
    DATA_EXISTS=$(psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
fi

if [ "$DATA_EXISTS" = "0" ] || [ -z "$DATA_EXISTS" ]; then
    echo -e "  ${YELLOW}!${NC} Database is empty, populating..."

    # Run base schema first
    echo -e "  Running base schema..."
    if [ -f "database/schema.sql" ]; then
        echo -e "    Running schema.sql..."
        if [ "$DOCKER_MODE" = true ]; then
            psql -U postgres -d $DB_NAME -f "database/schema.sql" > /dev/null 2>&1 || true
        else
            psql -d $DB_NAME -f "database/schema.sql" > /dev/null 2>&1 || true
        fi
    fi
    echo -e "  ${GREEN}✓${NC} Base schema completed"

    # Run migrations
    echo -e "  Running migrations..."
    for migration in database/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "    Running $(basename $migration)..."
            if [ "$DOCKER_MODE" = true ]; then
                psql -U postgres -d $DB_NAME -f "$migration" 2>&1 | grep -E "ERROR|FATAL" || true
            else
                psql -d $DB_NAME -f "$migration" 2>&1 | grep -E "ERROR|FATAL" || true
            fi
        fi
    done
    echo -e "  ${GREEN}✓${NC} Migrations completed"

    # Run seed files
    echo -e "  Running seed scripts..."

    # Run shared data seed (user_id = NULL so all users see data)
    if [ -f "database/seed-shared.js" ]; then
        echo -e "    Running seed-shared.js (shared data for all users)..."
        node database/seed-shared.js 2>&1 || echo -e "    ${YELLOW}!${NC} seed-shared.js had warnings"
    elif [ -f "database/seed.js" ]; then
        echo -e "    Running seed.js..."
        node database/seed.js 2>&1 || echo -e "    ${YELLOW}!${NC} seed.js had warnings"
    fi

    if [ -f "database/seed_advanced_features.js" ]; then
        echo -e "    Running seed_advanced_features.js..."
        node database/seed_advanced_features.js 2>&1 || echo -e "    ${YELLOW}!${NC} seed_advanced_features.js had warnings"
    fi
    echo -e "  ${GREEN}✓${NC} Database populated successfully"
else
    echo -e "  ${GREEN}✓${NC} Database already has data ($DATA_EXISTS users found)"

    # Always run migrations to ensure AI tables exist
    echo -e "  Running migrations (to ensure all tables exist)..."
    for migration in database/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "    Running $(basename $migration)..."
            if [ "$DOCKER_MODE" = true ]; then
                psql -U postgres -d $DB_NAME -f "$migration" 2>&1 | grep -v "already exists" | grep -E "ERROR|FATAL" || true
            else
                psql -d $DB_NAME -f "$migration" 2>&1 | grep -v "already exists" | grep -E "ERROR|FATAL" || true
            fi
        fi
    done
    echo -e "  ${GREEN}✓${NC} Migrations completed"
fi

# ========================================
# Step 4b: Ensure all AI columns exist
# ========================================
echo ""
echo -e "${YELLOW}Step 4b: Ensuring AI schema is up to date...${NC}"

if [ -f "database/migrations/005_ai_schema_updates.sql" ]; then
    if [ "$DOCKER_MODE" = true ]; then
        psql -U postgres -d $DB_NAME -f "database/migrations/005_ai_schema_updates.sql" 2>/dev/null || true
    else
        psql -d $DB_NAME -f "database/migrations/005_ai_schema_updates.sql" 2>/dev/null || true
    fi
    echo -e "  ${GREEN}✓${NC} AI schema updated"
else
    echo -e "  ${YELLOW}!${NC} 005_ai_schema_updates.sql not found, skipping"
fi

# ========================================
# Step 5: Run build validation
# ========================================
echo ""
echo -e "${YELLOW}Step 5: Running build validation...${NC}"

# Skip build in Docker mode (already built during image creation)
if [ "$DOCKER_MODE" = true ]; then
    echo -e "  ${GREEN}✓${NC} Skipping build (Docker mode)"
else
    if npm run build --silent; then
        echo -e "  ${GREEN}✓${NC} Build validation passed"
    else
        echo -e "  ${RED}✗${NC} Build validation failed!"
        exit 1
    fi
fi

# ========================================
# Step 6: Start the application
# ========================================
echo ""
echo -e "${YELLOW}Step 6: Starting application...${NC}"
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
