#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Starting Cascade City (Lane 3 Frontend) ===${NC}"

# Navigate to the lane3 directory
cd "$(dirname "$0")/lane3" || { echo "Failed to find lane3 directory"; exit 1; }

# Check if node_modules exists, if not run npm install
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
fi

echo -e "${GREEN}Starting development server...${NC}"
# Run the vite development server
npm run dev
