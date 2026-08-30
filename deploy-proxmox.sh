#!/bin/bash

# PostgreFlow — One-Click Proxmox Docker & Cloudflare Tunnel Deployer

echo "🚀 Deploying PostgreFlow to Docker on Proxmox..."

# 1. Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed on this system."
    exit 1
fi

# 2. Build and start containers in background
echo "📦 Building Docker image and starting services..."
docker compose up -d --build

# 3. Display status and Cloudflare public link
echo ""
echo "================================================="
echo "🎉 PostgreFlow Container Deployed Successfully!"
echo "================================================="
echo "Local Access: http://localhost:3000"
echo ""
echo "🔗 Fetching Cloudflare Tunnel Internet URL..."
sleep 3

# Fetch Cloudflare URL from container logs
TUNNEL_URL=$(docker logs postgres-form-tunnel 2>&1 | grep -o 'https://.*\.trycloudflare\.com' | head -n 1)

if [ -n "$TUNNEL_URL" ]; then
    echo "🌐 Public Internet Access URL: $TUNNEL_URL"
else
    echo "ℹ️ Cloudflare logs: Run 'docker logs postgres-form-tunnel' to view your live public HTTPS link!"
fi
echo "================================================="
