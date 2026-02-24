#!/bin/bash

# EcEClassroom D1 Database & Worker Deployment Script
# This script automates the setup and deployment process

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          EcEClassroom D1 Database Setup & Deploy               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}[1/5]${NC} Checking prerequisites..."
echo ""

if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}✗ Wrangler not found${NC}"
    echo "Install with: npm install -g @cloudflare/wrangler"
    exit 1
fi
echo -e "${GREEN}✓${NC} Wrangler CLI found: $(wrangler --version)"

if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Git found"

echo ""
echo -e "${BLUE}[2/5]${NC} Creating D1 database..."
echo ""

# Create D1 database
DB_OUTPUT=$(wrangler d1 create eclassroom --yes 2>&1 || true)
echo "$DB_OUTPUT"

# Extract database ID from output
DB_ID=$(echo "$DB_OUTPUT" | grep -oP '(?<=database_id: )[a-f0-9-]+' | head -1)

if [ -z "$DB_ID" ]; then
    echo -e "${YELLOW}⚠${NC} Could not auto-detect database ID"
    echo "Please manually update your wrangler.toml with the database_id shown above"
    read -p "Enter your database ID: " DB_ID
fi

if [ -z "$DB_ID" ]; then
    echo -e "${RED}✗ Database ID required to continue${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Database ID: $DB_ID"
echo ""

# Update wrangler.toml
echo -e "${BLUE}[3/5]${NC} Updating wrangler.toml..."
cd backend

if grep -q "database_id = \"YOUR_DB_ID\"" wrangler.toml; then
    sed -i.bak "s/database_id = \"YOUR_DB_ID\"/database_id = \"$DB_ID\"/" wrangler.toml
    echo -e "${GREEN}✓${NC} wrangler.toml updated"
else
    echo -e "${YELLOW}⚠${NC} Could not update wrangler.toml - please manually set:"
    echo "  database_id = \"$DB_ID\""
fi

echo ""
echo -e "${BLUE}[4/5]${NC} Running database migrations..."
echo ""

# Run migration
if wrangler d1 execute eclassroom --file migrations/0001_init.sql --remote; then
    echo -e "${GREEN}✓${NC} Migration completed successfully"
else
    echo -e "${YELLOW}⚠${NC} Remote migration may have issues"
    echo "Trying local migration for validation..."
    wrangler d1 execute eclassroom --file migrations/0001_init.sql --local || true
fi

echo ""
echo -e "${BLUE}[5/5]${NC} Deploying Worker..."
echo ""

# Deploy Worker
if wrangler deploy; then
    WORKER_URL="https://ec-eclassroom-backend.espaderarios.workers.dev"
    echo -e "${GREEN}✓${NC} Worker deployed successfully"
    echo ""
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo ""
    echo "📍 Worker URL: $WORKER_URL"
    echo "📊 Database ID: $DB_ID"
    echo ""
    echo "Next steps:"
    echo "  1. Test the health endpoint:"
    echo "     curl $WORKER_URL/health"
    echo ""
    echo "  2. Verify database connectivity:"
    echo "     curl -X GET \"$WORKER_URL/api/flashcards?userId=test_user\""
    echo ""
    echo "  3. Check Cloudflare Dashboard:"
    echo "     https://dash.cloudflare.com → Workers → ec-eclassroom-backend"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
