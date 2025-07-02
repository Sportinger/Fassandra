#!/bin/bash
set -e

# 🚀 Universal Deployment Script for Pessoa
# Handles different deployment strategies based on arguments

DEPLOYMENT_TYPE=${1:-"help"}

show_help() {
    echo "🚀 Pessoa Deployment Script"
    echo ""
    echo "Usage: ./scripts/deploy.sh [OPTION]"
    echo ""
    echo "Options:"
    echo "  dev         🔧 Deploy current code with fast local build"
    echo "  dev-images  📦 Deploy pre-built dev branch images from GitHub Actions"
    echo "  production  🌐 Trigger production deployment via GitHub Actions"
    echo "  status      📊 Show current deployment status"
    echo "  help        ❓ Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/deploy.sh dev         # Fast local build + deploy"
    echo "  ./scripts/deploy.sh dev-images  # Use GitHub Actions dev images"
    echo "  ./scripts/deploy.sh production  # Full production deployment"
    echo ""
}

case $DEPLOYMENT_TYPE in
    "dev")
        echo "🔧 Starting fast local development deployment..."
        ./scripts/dev_deploy.sh
        ;;
    
    "dev-images")
        echo "📦 Deploying pre-built dev branch images..."
        ./scripts/deploy_dev_images.sh
        ;;
    
    "production")
        echo "🌐 Triggering production deployment via GitHub Actions..."
        
        CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
        if [ "$CURRENT_BRANCH" != "main" ]; then
            echo "⚠️  You're on branch: $CURRENT_BRANCH"
            echo "   Production deploys from 'main' branch only."
            echo ""
            echo "Options:"
            echo "1. Switch to main and merge your changes:"
            echo "   git checkout main && git merge $CURRENT_BRANCH && git push origin main"
            echo ""
            echo "2. Push current branch to dev for GitHub Actions build:"
            echo "   git push origin $CURRENT_BRANCH"
            echo "   Then use: ./scripts/deploy.sh dev-images"
            echo ""
            exit 1
        fi
        
        echo "📤 Pushing to main branch (triggers GitHub Actions)..."
        git push origin main
        echo ""
        echo "✅ Production deployment started!"
        echo "   Monitor progress: https://github.com/Sportinger/pessoa/actions"
        echo "   Deployment will complete in ~15 minutes"
        echo ""
        ;;
    
    "status")
        echo "📊 Checking deployment status..."
        echo ""
        
        echo "🏠 Local repository:"
        echo "  Branch: $(git rev-parse --abbrev-ref HEAD)"
        echo "  Commit: $(git rev-parse --short HEAD)"
        echo "  Status: $(git status --porcelain | wc -l) uncommitted changes"
        echo ""
        
        echo "🌐 Production server status:"
        ssh roman@mylayer.org << 'EOF'
            cd /opt/pessoa
            echo "  IMAGE_TAG: $(grep '^IMAGE_TAG=' .env | cut -d'=' -f2)"
            echo "  Container Status:"
            docker compose -f docker-compose.hetzner-github-actions.yml ps --format "table {{.Service}}\t{{.State}}\t{{.Status}}"
EOF
        echo ""
        echo "🔗 Live Sites:"
        echo "  Production: https://mylayer.org:8443"
        echo "  Test: https://pessoa.com.de:8443"
        echo ""
        ;;
    
    "help"|*)
        show_help
        ;;
esac 