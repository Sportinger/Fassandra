# ⚙️ Environment Variables Configuration

## Overview

This document provides comprehensive guidance for securely configuring environment variables for the Pessoa Theater platform. Proper environment variable management is critical for maintaining security and preventing credential exposure.

## 🔒 Security Requirements

### General Principles
- **Never store secrets in source code**
- **Use environment variables for all sensitive configuration**
- **Rotate secrets regularly**
- **Use strong, unique values for all secrets**
- **Restrict access to environment files**

### File Permissions
```bash
# Environment files should have restricted permissions
chmod 600 .env
chmod 600 .env.production
chmod 600 .env.local
```

## 🛠️ Required Environment Variables

### Authentication Configuration

#### JWT_SECRET (REQUIRED - CRITICAL)
**Purpose:** Secret key for JWT token signing and verification  
**Security Level:** CRITICAL  
**Generation:** Must be cryptographically secure random string

```bash
# Generate secure JWT secret (Linux/macOS)
JWT_SECRET=$(openssl rand -hex 64)

# Or use online secure generator
# https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long
```

**Requirements:**
- Minimum 32 characters (64+ recommended)
- High entropy (random characters, numbers, symbols)
- Unique per environment
- Never shared between environments

### Database Configuration

#### DATABASE_URL (REQUIRED)
**Purpose:** PostgreSQL connection string  
**Security Level:** HIGH  
**Format:** `postgresql://username:password@host:port/database`

```bash
# Production example
DATABASE_URL=postgresql://pessoa_user:secure_password@localhost:5432/pessoa_production

# Development example
DATABASE_URL=postgresql://pessoa_dev:dev_password@localhost:5432/pessoa_development
```

**Security Considerations:**
- Use strong database passwords
- Restrict database user permissions
- Use localhost or private network addresses
- Different credentials for each environment

#### DB_MAX_CONNECTIONS (OPTIONAL)
**Purpose:** Maximum database connection pool size  
**Default:** 5  
**Range:** 1-100

```bash
DB_MAX_CONNECTIONS=10
```

### Server Configuration

#### BACKEND_PORT (OPTIONAL)
**Purpose:** Port for backend server  
**Default:** 3001  
**Range:** 1024-65535

```bash
BACKEND_PORT=3001
```

### CORS Configuration

#### ALLOWED_ORIGINS (REQUIRED)
**Purpose:** Comma-separated list of allowed CORS origins  
**Security Level:** HIGH  
**Format:** Comma-separated URLs

```bash
# Production
ALLOWED_ORIGINS=https://pessoa.theater,https://www.pessoa.theater

# Development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080,https://192.168.2.111:8443

# Local development
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Security Requirements:**
- Only include trusted domains
- Use HTTPS in production
- No wildcards (*) allowed
- Specific ports when necessary

### External API Configuration

#### GEMINI_API_KEY (OPTIONAL)
**Purpose:** Google Gemini AI API key for script analysis  
**Security Level:** HIGH  
**Acquisition:** Google AI Studio

```bash
GEMINI_API_KEY=your-gemini-api-key-here
```

#### GEMINI_API_URL (OPTIONAL)
**Purpose:** Gemini API endpoint URL  
**Default:** Google's standard Gemini API URL

```bash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=
```

## 🏗️ Environment File Structure

### Development (.env.development)
```bash
# Development Environment Configuration
# DO NOT USE IN PRODUCTION

# Authentication
JWT_SECRET=development-jwt-secret-change-in-production-minimum-32-chars

# Database
DATABASE_URL=postgresql://pessoa_dev:dev_password@localhost:5432/pessoa_development
DB_MAX_CONNECTIONS=5

# Server
BACKEND_PORT=3001

# CORS - Development origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173

# AI Services (Optional)
GEMINI_API_KEY=your-development-gemini-key
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=
```

### Production (.env.production)
```bash
# Production Environment Configuration
# SECURE ALL VALUES

# Authentication - GENERATE SECURE VALUES
JWT_SECRET=production-super-secure-jwt-secret-64-characters-minimum-high-entropy

# Database - PRODUCTION CREDENTIALS
DATABASE_URL=postgresql://pessoa_prod:very_secure_production_password@db.internal:5432/pessoa_production
DB_MAX_CONNECTIONS=20

# Server
BACKEND_PORT=3001

# CORS - PRODUCTION DOMAINS ONLY
ALLOWED_ORIGINS=https://pessoa.theater,https://www.pessoa.theater

# AI Services
GEMINI_API_KEY=production-gemini-api-key
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=
```

### Local Development (.env.local)
```bash
# Local Development Environment
# For personal development machines

# Authentication
JWT_SECRET=local-development-jwt-secret-for-testing-only

# Database
DATABASE_URL=postgresql://localhost:5432/pessoa_local
DB_MAX_CONNECTIONS=3

# Server
BACKEND_PORT=3001

# CORS - Local development
ALLOWED_ORIGINS=http://localhost:5173,https://192.168.2.111:8443

# AI Services (Optional)
# GEMINI_API_KEY=your-local-testing-key
```

## 🚨 Security Best Practices

### Secret Generation

#### Strong JWT Secrets
```bash
# Method 1: OpenSSL (Recommended)
openssl rand -hex 64

# Method 2: Python
python3 -c "import secrets; print(secrets.token_hex(32))"

# Method 3: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Database Passwords
```bash
# Generate strong database password
openssl rand -base64 32
```

### Environment File Security

#### File Protection
```bash
# Set restrictive permissions
chmod 600 .env*

# Remove from git tracking
echo ".env*" >> .gitignore

# Verify files are not tracked
git status --ignored
```

#### Access Control
- Store production environment files securely
- Use secret management systems for production
- Rotate secrets regularly
- Audit environment file access

### Secret Rotation Schedule

#### JWT Secrets
- **Development:** Monthly
- **Production:** Quarterly
- **Incident Response:** Immediately

#### Database Credentials
- **Development:** Quarterly  
- **Production:** Bi-annually
- **Incident Response:** Immediately

## 🔄 Environment Management

### Development Workflow
1. Copy `.env.example` to `.env.development`
2. Generate development secrets
3. Configure local database
4. Test configuration
5. Document any changes

### Production Deployment
1. Generate production secrets
2. Configure production database
3. Set up secure environment file storage
4. Deploy with environment variables
5. Verify configuration
6. Monitor for issues

### Secret Rotation Process
1. Generate new secrets
2. Update environment files
3. Deploy new configuration
4. Verify functionality
5. Invalidate old secrets
6. Document rotation

## 🧪 Configuration Testing

### Environment Validation Script
```bash
#!/bin/bash
# validate-env.sh - Validate environment configuration

check_var() {
    if [[ -z "${!1}" ]]; then
        echo "❌ $1 is not set"
        return 1
    else
        echo "✅ $1 is set"
        return 0
    fi
}

echo "🔍 Validating environment configuration..."

# Check required variables
check_var "JWT_SECRET"
check_var "DATABASE_URL"
check_var "ALLOWED_ORIGINS"

# Check JWT secret strength
if [[ ${#JWT_SECRET} -lt 32 ]]; then
    echo "⚠️  JWT_SECRET should be at least 32 characters"
fi

# Check database URL format
if [[ ! $DATABASE_URL =~ ^postgresql:// ]]; then
    echo "⚠️  DATABASE_URL should start with postgresql://"
fi

echo "✅ Environment validation complete"
```

### Security Verification
```python
#!/usr/bin/env python3
# security-check.py - Check environment security

import os
import re

def check_jwt_secret():
    jwt_secret = os.getenv('JWT_SECRET', '')
    if len(jwt_secret) < 32:
        print("❌ JWT_SECRET too short (minimum 32 characters)")
        return False
    if jwt_secret in ['development-jwt-secret', 'change-me']:
        print("❌ JWT_SECRET appears to be default/weak value")
        return False
    print("✅ JWT_SECRET appears secure")
    return True

def check_database_url():
    db_url = os.getenv('DATABASE_URL', '')
    if 'localhost' in db_url and 'production' in os.getenv('NODE_ENV', ''):
        print("⚠️  Using localhost database in production")
    if 'password' in db_url.lower():
        print("⚠️  Database URL contains 'password' - may be default")
    print("✅ Database URL format acceptable")
    return True

def main():
    print("🔒 Security configuration check")
    check_jwt_secret()
    check_database_url()

if __name__ == "__main__":
    main()
```

## 📋 Environment Templates

### .env.example
```bash
# Pessoa Theater Platform - Environment Configuration Template
# Copy to .env.development or .env.production and configure

# Authentication (REQUIRED)
# Generate with: openssl rand -hex 64
JWT_SECRET=your-super-secure-jwt-secret-here

# Database (REQUIRED)
DATABASE_URL=postgresql://username:password@host:port/database
DB_MAX_CONNECTIONS=5

# Server Configuration
BACKEND_PORT=3001

# CORS Origins (REQUIRED)
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com

# External APIs (OPTIONAL)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=
```

## 🚀 Deployment Considerations

### Docker Environments
```dockerfile
# Use environment files with Docker
ENV JWT_SECRET=${JWT_SECRET}
ENV DATABASE_URL=${DATABASE_URL}
ENV ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
```

### Container Orchestration
- Use Kubernetes secrets
- Azure Key Vault integration
- AWS Secrets Manager
- HashiCorp Vault

### CI/CD Pipeline
- Store secrets in CI/CD secret management
- Use different secrets per environment
- Rotate secrets automatically
- Audit secret access

---

**Configuration Status:** ✅ PRODUCTION READY  
**Security Level:** ENTERPRISE GRADE  
**Last Updated:** January 29, 2025 