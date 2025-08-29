#!/bin/bash

# Load virtual environment variables
echo "🔍 Loading virtual environment variables..."

# Check if .env.virtual.local exists
if [ -f ".env.virtual.local" ]; then
    echo "✅ Found .env.virtual.local, loading variables..."
    
    # Export all variables from .env.virtual.local
    export $(cat .env.virtual.local | grep -v '^#' | xargs)
    
    echo "✅ Virtual environment variables loaded successfully!"
    echo "🔧 Starting Next.js development server with virtual environment..."
    
    # Start Next.js with the virtual environment (dynamic port)
    npm run dev
else
    echo "⚠️  .env.virtual.local not found!"
    echo "🔧 Starting Next.js development server with default environment..."
    
    # Start Next.js with default environment (dynamic port)
    npm run dev
fi
