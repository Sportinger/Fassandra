# 🎭 Pessoa Dual Environment Setup

## 📋 **Overview**

Pessoa now has **two completely separate environments** running simultaneously:

### **🎯 Production Environment**
- **Domain:** `pessoa.theater`
- **Purpose:** Stable, user-facing application
- **Ports:** 80 (HTTP), 443 (HTTPS), 3001 (Backend), 5432 (DB), 5050 (PgAdmin)
- **Database:** `pessoa_production` (Port 5432)
- **Container Prefix:** `prod_`

### **🧪 Development Environment**  
- **Domain:** `mylayer.org`
- **Purpose:** Testing, experimental features
- **Ports:** 8080 (HTTP), 8443 (HTTPS), 3002 (Backend), 5434 (DB), 5051 (PgAdmin)
- **Database:** `pessoa_development` (Port 5434)
- **Container Prefix:** `dev_`

---

## 🚀 **Deployment Commands**

### **Production Deployment:**
```bash
./scripts/deploy_production.sh
```

### **Development Deployment:**
```bash
./scripts/deploy_development.sh
```

### **Deploy Both Environments:**
```bash
./scripts/deploy_production.sh && ./scripts/deploy_development.sh
```

---

## 🔧 **Environment Files**

### **Production Config:** `.env.production`
```env
APP_HOSTNAME=pessoa.theater
BACKEND_PORT=3001
FRONTEND_PORT=80
FRONTEND_HTTPS_PORT=443
DB_PORT=5432
CONTAINER_PREFIX=prod_
DATABASE_URL=postgresql://pessoa_user:password@prod_pessoa_db:5432/pessoa_production
```

### **Development Config:** `.env.development`
```env
APP_HOSTNAME=mylayer.org
BACKEND_PORT=3002
FRONTEND_PORT=8080
FRONTEND_HTTPS_PORT=8443
DB_PORT=5434
CONTAINER_PREFIX=dev_
DATABASE_URL=postgresql://pessoa_dev_user:password@dev_pessoa_db:5432/pessoa_development
```

---

## 📊 **Container Overview**

### **Production Containers:**
- `prod_pessoa_frontend` → pessoa.theater:80/443
- `prod_pessoa_backend` → localhost:3001
- `prod_pessoa_db` → localhost:5432
- `prod_pessoa_pgadmin` → localhost:5050

### **Development Containers:**
- `dev_pessoa_frontend` → mylayer.org:8080/8443
- `dev_pessoa_backend` → localhost:3002
- `dev_pessoa_db` → localhost:5434
- `dev_pessoa_pgadmin` → localhost:5051

---

## 🔍 **Monitoring & Management**

### **Check Running Containers:**
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

### **View Logs:**
```bash
# Production logs
docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f

# Development logs  
docker-compose -f docker-compose.staging.yml --env-file .env.development logs -f
```

### **Stop Environments:**
```bash
# Stop production
docker-compose -f docker-compose.prod.yml --env-file .env.production down

# Stop development
docker-compose -f docker-compose.staging.yml --env-file .env.development down
```

---

## 🌐 **Access URLs**

### **Production (pessoa.theater):**
- **Frontend:** https://pessoa.theater
- **Backend API:** https://pessoa.theater/api
- **WebSocket:** wss://pessoa.theater/ws
- **PgAdmin:** http://localhost:5050

### **Development (mylayer.org):**
- **Frontend:** https://mylayer.org:8443
- **Backend API:** https://mylayer.org:8443/api  
- **WebSocket:** wss://mylayer.org:8443/ws
- **PgAdmin:** http://localhost:5051

---

## 🔄 **Data Separation**

### **Databases:**
- **Production:** `pessoa_production` (completely separate data)
- **Development:** `pessoa_development` (isolated test data)

### **Volumes:**
- **Production:** `prod_pessoa_pgdata`, `prod_pessoa_pgadmin_data`
- **Development:** `dev_pessoa_pgdata`, `dev_pessoa_pgadmin_data`

---

## ⚠️ **Important Notes**

1. **Port Conflicts:** Make sure both environments use different ports
2. **SSL Certificates:** Both environments share the same SSL certs (configured for both domains)
3. **Database Isolation:** Changes in dev don't affect production data
4. **Independent Deployments:** Each environment can be deployed separately
5. **Resource Usage:** Running both environments doubles resource consumption

---

## 🛠️ **Troubleshooting**

### **If containers conflict:**
```bash
# Stop all pessoa containers
docker stop $(docker ps -q --filter "name=pessoa")

# Remove all pessoa containers  
docker rm $(docker ps -aq --filter "name=pessoa")

# Redeploy both environments
./scripts/deploy_production.sh && ./scripts/deploy_development.sh
```

### **If ports are blocked:**
```bash
# Check what's using ports
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
sudo netstat -tulpn | grep :8080
sudo netstat -tulpn | grep :8443
```

### **Reset environment:**
```bash
# Nuclear option - remove everything
docker-compose -f docker-compose.prod.yml --env-file .env.production down -v
docker-compose -f docker-compose.staging.yml --env-file .env.development down -v
docker volume prune -f
```

---

## 🎯 **Workflow Recommendations**

1. **Development:** Test features on `mylayer.org:8443`
2. **Staging:** Once stable, deploy to production
3. **Production:** Keep `pessoa.theater` stable for users
4. **Database:** Use development DB for testing, production DB for real data
5. **Monitoring:** Check both environments regularly with `docker ps` 