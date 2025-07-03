# 🧪 Development Environment Guide

## Overview

We now have a **dual-environment setup** to safely test experimental features:

- **🌐 Production**: `https://pessoa.theater` - Stable, user-facing
- **🧪 Development**: `https://mylayer.org:8444` - Testing, experimental features

## 🚀 Quick Start

### 1. Setup Development Environment (One-time)

```bash
./scripts/setup_staging.sh
```

### 2. Deploy to Development

```bash
./scripts/deploy_staging.sh
```

### 3. Deploy to Production (after testing)

```bash
./scripts/build_and_push.sh
```

## 📋 Environment Details

### Production Environment
- **URL**: https://pessoa.theater
- **Backend**: Port 3001
- **Database**: Port 5433
- **PgAdmin**: Port 5050
- **Purpose**: Stable, user-facing application

### Development Environment
- **URL**: https://mylayer.org:8444
- **Backend**: Port 3002
- **Database**: Port 5434
- **PgAdmin**: Port 5051
- **Purpose**: Testing experimental features

## 🔧 Workflow

### For Experimental Features

1. **Make changes** in your code
2. **Test development**: `./scripts/deploy_staging.sh`
3. **Verify** at https://mylayer.org:8444
4. **If good**: `./scripts/build_and_push.sh` for production
5. **If bad**: Fix issues, repeat from step 1

### For Safe Changes

1. **Small fixes** can go directly to production
2. **Use**: `./scripts/build_and_push.sh`

## 🛠️ Advanced Usage

### Update Development Configuration

```bash
ssh roman@mylayer.org
cd ~/pessoa-staging
nano .env
```

### View Development Logs

```bash
ssh roman@mylayer.org
cd ~/pessoa-staging
docker compose -f docker-compose.staging.yml logs -f
```

### Reset Development Database

```bash
ssh roman@mylayer.org
cd ~/pessoa-staging
docker compose -f docker-compose.staging.yml down -v
docker compose -f docker-compose.staging.yml up -d
```

## 🔍 Monitoring

### Check Status

```bash
ssh roman@mylayer.org
cd ~/pessoa-staging
docker compose -f docker-compose.staging.yml ps
```

### View Logs

```bash
# All services
docker compose -f docker-compose.staging.yml logs

# Specific service
docker compose -f docker-compose.staging.yml logs backend
docker compose -f docker-compose.staging.yml logs frontend
```

## 🚨 Troubleshooting

### Development Not Loading

1. Check if containers are running:
   ```bash
   ssh roman@mylayer.org
   cd ~/pessoa-staging
   docker compose -f docker-compose.staging.yml ps
   ```

2. Check logs for errors:
   ```bash
   docker compose -f docker-compose.staging.yml logs
   ```

3. Restart services:
   ```bash
   docker compose -f docker-compose.staging.yml restart
   ```

### Port Conflicts

If you get port conflicts, update the ports in `docker-compose.staging.yml`:

- Frontend HTTPS: Change `8444:443` to another port
- Backend: Change `3002:3001` to another port
- Database: Change `5434:5432` to another port

## 📁 File Structure

```
/opt/pessoa/          # Production environment (pessoa.theater)
├── .env              # Production config
└── docker-compose.hetzner-github-actions.yml

~/pessoa-staging/     # Development environment (mylayer.org)
├── .env              # Development config
└── docker-compose.staging.yml
```

## 🎯 Benefits

- **Safe Testing**: Experiment without breaking production
- **Parallel Development**: Test new features while production runs
- **Easy Rollback**: Production remains stable during experiments
- **Confidence**: Verify changes work before going live

## 🚀 Next Steps

1. Run `./scripts/setup_staging.sh` to initialize
2. Copy the staging docker-compose file to server
3. Start testing experimental features safely!

Happy coding! 🎭 