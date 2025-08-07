# 🛠️ Troubleshooting Guide

This guide helps you diagnose and fix common issues with Pessoa. Issues are organized by symptoms and provide step-by-step solutions.

## 🚨 Emergency Quick Fixes

### System Not Responding
```bash
# Quick restart everything
docker compose down && docker compose up -d

# Hard reset (DESTROYS DATA!)
docker compose down -v && docker compose up -d
```

### Cannot Access Web Interface
```bash
# Check if containers are running
docker ps

# If nothing is running:
docker compose up -d

# If containers are running but can't access:
curl -k https://localhost:8080
```

## 🔍 Common Issues by Category

### 🌐 Web Interface Issues

#### Issue: "This site can't be reached" or "Connection refused"

**Symptoms:**
- Browser shows "This site can't be reached"
- "Connection refused" errors
- Cannot access https://localhost:8080

**Diagnosis:**
```bash
# Check if containers are running
docker ps

# Check if ports are open
netstat -tlnp | grep 8080

# Check container logs
docker logs dev_pessoa_frontend
```

**Solutions:**
1. **Start containers** if they're not running:
   ```bash
   docker compose up -d
   ```

2. **Check port conflicts**:
   ```bash
   # Kill process using port 8080
   sudo lsof -ti:8080 | xargs kill -9
   
   # Restart Pessoa
   docker compose restart
   ```

3. **Verify firewall settings**:
   ```bash
   # Allow port 8080
   sudo ufw allow 8080/tcp
   ```

#### Issue: "SSL Certificate Error" or "Not Secure"

**Symptoms:**
- Browser shows "Your connection is not private"
- SSL certificate warnings
- "NET::ERR_CERT_AUTHORITY_INVALID"

**Solutions:**
1. **Accept self-signed certificate** (Development):
   - Click "Advanced" → "Proceed to localhost (unsafe)"
   - This is normal for development with self-signed certificates

2. **Generate new certificates**:
   ```bash
   # Remove old certificates
   rm -rf frontend/ssl/
   
   # Restart to generate new ones
   docker compose down
   docker compose up -d
   ```

3. **Use proper SSL certificates** (Production):
   - See [SSL Setup Guide](../deployment/ssl-setup.md)

### 🔐 Authentication Issues

#### Issue: "Invalid credentials" or Cannot Login

**Symptoms:**
- Login fails with correct credentials
- "Invalid username or password" errors
- Login form doesn't respond

**Diagnosis:**
```bash
# Check backend logs
docker logs dev_pessoa_backend | grep -i "login\|auth\|error"

# Test backend directly
curl -k -X POST https://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pessoa.de","password":"PassoaDevteam"}'
```

**Solutions:**
1. **Use correct default credentials**:
   - Email: `admin@pessoa.de`
   - Password: `PassoaDevteam`

2. **Check if backend is running**:
   ```bash
   docker ps | grep backend
   docker logs dev_pessoa_backend
   ```

3. **Reset database** (DESTROYS DATA!):
   ```bash
   docker compose down -v
   docker compose up -d
   ```

#### Issue: "JWT Token Invalid" or Session Expires

**Symptoms:**
- Logged out unexpectedly
- "Authentication failed" errors
- Token expired messages

**Solutions:**
1. **Check JWT secret configuration**:
   ```bash
   # Verify JWT_SECRET is set
   grep JWT_SECRET .env
   
   # Should be at least 32 characters
   ```

2. **Restart backend** to reload config:
   ```bash
   docker compose restart backend
   ```

3. **Clear browser storage**:
   - Press F12 → Application → Storage → Clear All

### 📄 Script Upload Issues

#### Issue: "NetworkError when attempting to fetch resource"

**Symptoms:**
- Upload fails with NetworkError
- Upload progress stops at 0%
- Cannot upload .docx files

**Diagnosis:**
```bash
# Test upload endpoint
curl -k -X POST https://localhost:8080/api/s/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "scriptFile=@test.docx"

# Check backend logs
docker logs dev_pessoa_backend | grep -i "upload\|error"
```

**Solutions:**
1. **Restart frontend** to reload proxy config:
   ```bash
   docker compose restart frontend
   ```

2. **Check backend connectivity**:
   ```bash
   # Test backend directly
   curl -k https://localhost:8080/api/health
   ```

3. **Verify file format**:
   - Only `.docx` files are supported
   - File size should be under 10MB

#### Issue: "Upload failed" or "Analysis failed"

**Symptoms:**
- Upload completes but analysis fails
- "Error parsing content" messages
- Script created but no content

**Solutions:**
1. **Check Gemini API key**:
   ```bash
   # Verify API key is set
   grep GEMINI_API_KEY .env
   
   # Test API key
   curl -H "Authorization: Bearer YOUR_GEMINI_KEY" \
     https://generativelanguage.googleapis.com/v1beta/models
   ```

2. **Check backend logs** for AI errors:
   ```bash
   docker logs dev_pessoa_backend | grep -i "gemini\|ai\|parse"
   ```

3. **Try different document format**:
   - Ensure document is properly formatted
   - Remove complex formatting or tables
   - Save as simple .docx without macros

### 🤝 Real-time Collaboration Issues

#### Issue: "WebSocket connection failed" or No Real-time Updates

**Symptoms:**
- Changes don't appear in real-time
- User counter shows 0
- WebSocket connection errors in browser console

**Diagnosis:**
```bash
# Check WebSocket endpoint
curl -k -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://localhost:8080/api/collab/test

# Check backend WebSocket logs
docker logs dev_pessoa_backend | grep -i "websocket\|collab"
```

**Solutions:**
1. **Fix WebSocket URL configuration**:
   ```bash
   # Check environment variables
   grep -E "(WS_BASE_URL|APP_HOSTNAME)" .env
   
   # For mobile access, use IP address instead of localhost
   APP_HOSTNAME=192.168.1.100  # Your actual IP
   ```

2. **Restart frontend** to reload WebSocket config:
   ```bash
   docker compose restart frontend
   ```

3. **Check browser console** for WebSocket errors:
   - Press F12 → Console
   - Look for WebSocket-related errors

#### Issue: "Cursor jumping" or Editor Crashes

**Symptoms:**
- Cursor jumps to end of document
- Editor freezes or crashes
- Infinite re-rendering

**Solutions:**
1. **Hard refresh browser**:
   - Press Ctrl+Shift+R (Windows/Linux)
   - Press Cmd+Shift+R (Mac)

2. **Clear browser cache**:
   - Press F12 → Application → Storage → Clear All

3. **Check for JavaScript errors**:
   - Press F12 → Console
   - Look for React or editor errors

### 🐳 Docker Issues

#### Issue: "Container won't start" or "Exit code 1"

**Symptoms:**
- Containers immediately exit
- "Container exited with code 1" errors
- Services not starting

**Diagnosis:**
```bash
# Check container status
docker ps -a

# Check logs for specific container
docker logs container_name

# Check resource usage
docker stats
```

**Solutions:**
1. **Check disk space**:
   ```bash
   df -h
   # If disk is full, clean up:
   docker system prune -a
   ```

2. **Check memory usage**:
   ```bash
   free -h
   # If memory is low, restart system or increase swap
   ```

3. **Rebuild containers**:
   ```bash
   docker compose down
   docker compose up -d --build
   ```

#### Issue: "Permission denied" or "Volume mount failed"

**Symptoms:**
- Permission errors in logs
- Cannot write to volumes
- Database initialization fails

**Solutions:**
1. **Fix volume permissions**:
   ```bash
   # Fix PostgreSQL volume permissions
   sudo chown -R 999:999 ./postgres-data/
   
   # Fix general permissions
   sudo chown -R $USER:$USER ./
   ```

2. **Check SELinux** (if applicable):
   ```bash
   # Disable SELinux temporarily
   sudo setenforce 0
   ```

### 📱 Mobile Browser Issues

#### Issue: "Cannot access from mobile" or "localhost not accessible"

**Symptoms:**
- Mobile browser can't reach localhost
- "This site can't be reached" on mobile
- Desktop works, mobile doesn't

**Solutions:**
1. **Use IP address instead of localhost**:
   ```bash
   # Find your IP address
   ip addr show | grep inet
   
   # Update .env file
   APP_HOSTNAME=192.168.1.100  # Your actual IP
   
   # Restart frontend
   docker compose restart frontend
   ```

2. **Connect to same network**:
   - Ensure mobile device is on same Wi-Fi network
   - Check router settings for device isolation

3. **Test connectivity**:
   ```bash
   # From mobile browser, try:
   https://192.168.1.100:8080
   ```

#### Issue: "WebSocket connection failed on mobile"

**Symptoms:**
- Real-time collaboration works on desktop but not mobile
- Mobile console shows WebSocket errors

**Solutions:**
1. **Use secure WebSocket (WSS)**:
   ```bash
   # Update .env file
   VITE_WS_BASE_URL=wss://192.168.1.100:8080/api/collab
   
   # Restart frontend
   docker compose restart frontend
   ```

2. **Check mobile browser console**:
   - Enable developer tools on mobile
   - Look for WebSocket connection errors

### 🗄️ Database Issues

#### Issue: "Database connection failed" or "Connection refused"

**Symptoms:**
- Backend cannot connect to database
- "Connection refused" errors
- Database not starting

**Diagnosis:**
```bash
# Check if database container is running
docker ps | grep db

# Check database logs
docker logs dev_pessoa_db

# Test database connection
docker exec dev_pessoa_db psql -U pessoa_user -d pessoa_db -c "SELECT 1;"
```

**Solutions:**
1. **Restart database**:
   ```bash
   docker compose restart db
   ```

2. **Check database credentials**:
   ```bash
   # Verify database environment variables
   grep -E "(POSTGRES|DATABASE)" .env
   ```

3. **Reset database** (DESTROYS DATA!):
   ```bash
   docker compose down -v
   docker volume rm dev_pessoa_db_data
   docker compose up -d
   ```

#### Issue: "Database schema outdated" or Migration errors

**Symptoms:**
- "Table doesn't exist" errors
- Migration failures
- Schema version mismatch

**Solutions:**
1. **Run migrations manually**:
   ```bash
   # Connect to database
   docker exec -it dev_pessoa_db psql -U pessoa_user -d pessoa_db
   
   # Check current schema
   \dt
   ```

2. **Reset database and re-run migrations**:
   ```bash
   docker compose down -v
   docker compose up -d
   ```

## 🔍 Diagnostic Commands

### System Health Check
```bash
# Quick system overview
docker ps
docker stats --no-stream
df -h
free -h

# Test all endpoints
curl -k https://localhost:8080/api/health
curl -k https://localhost:8080/api/scripts
```

### Log Analysis
```bash
# View all logs
docker compose logs -f

# View specific service logs
docker logs dev_pessoa_backend -f
docker logs dev_pessoa_frontend -f
docker logs dev_pessoa_db -f

# Search for errors
docker logs dev_pessoa_backend | grep -i error
```

### Network Diagnostics
```bash
# Check port usage
netstat -tlnp | grep -E "(8080|3001|5432)"

# Test connectivity
curl -k https://localhost:8080
telnet localhost 8080
```

## 🆘 Getting Help

### Self-Service Resources
1. **[Architecture Guide](../architecture/README.md)** - Understand how Pessoa works
2. **[Deployment Guide](../deployment/README.md)** - Deployment-specific issues
3. **[API Reference](../api/README.md)** - API-related problems

### Community Support
- **[Discord Server](https://discord.gg/your-invite)** - Real-time help
- **[GitHub Issues](https://github.com/your-org/pessoa/issues)** - Bug reports
- **[FAQ](../reference/faq.md)** - Frequently asked questions

### When Reporting Issues
Please include:
1. **Error message** (exact text)
2. **Steps to reproduce** the issue
3. **System information** (OS, Docker version)
4. **Container logs** (`docker logs container_name`)
5. **Environment configuration** (without secrets)

### Emergency Contact
For critical production issues:
- **Email**: support@pessoa.theater
- **Priority**: Include "URGENT" in subject line

---

**Last Updated**: January 2025  
**Coverage**: Common issues and solutions  
**Difficulty**: All levels  
**Status**: ✅ Continuously updated 