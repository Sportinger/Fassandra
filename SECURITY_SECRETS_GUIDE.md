# 🔐 SECURITY SECRETS GUIDE

This guide covers proper secret management for the Pessoa Theater platform.

## 🚨 CRITICAL: ROTATE ALL SECRETS IMMEDIATELY

After the security audit, all secrets must be rotated. The following secrets were previously exposed:

### 1. JWT_SECRET - ROTATE IMMEDIATELY

**Current Problem**: The old JWT_SECRET was hardcoded and exposed in source code.

**New Secure Secret**: 
```bash
# Generate a new secure JWT_SECRET (32+ bytes, base64 encoded)
JWT_SECRET=JDrpHPHR16C6lgljx5VEQmf+Mzei3foIFcWKC1sSFFw=
```

**Action Required**: Update your .env file with the new JWT_SECRET above.

### 2. GEMINI_API_KEY - OBTAIN AND CONFIGURE

**Current Problem**: Placeholder API key in configuration.

**Action Required**: 
1. Get your actual Gemini API key from https://makersuite.google.com/app/apikey
2. Update your .env file:
```bash
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 3. Database Passwords - CHANGE FOR PRODUCTION

**Current Problem**: Default development passwords.

**Action Required**: For production, use strong passwords:
```bash
# Generate strong passwords for production
POSTGRES_PASSWORD=$(openssl rand -base64 32)
PGADMIN_DEFAULT_PASSWORD=$(openssl rand -base64 24)
```

## 🛡️ PRODUCTION SECURITY CHECKLIST

### Environment Variables
- [ ] JWT_SECRET: Updated with secure 32-byte base64 key
- [ ] GEMINI_API_KEY: Set to actual API key (not placeholder)
- [ ] POSTGRES_PASSWORD: Changed from default
- [ ] PGADMIN_DEFAULT_PASSWORD: Changed from default
- [ ] APP_DOMAIN: Set to actual production domain
- [ ] ALLOWED_ORIGINS: Restricted to production domains only

### Secret Management Best Practices
1. **Never commit secrets to version control**
2. **Use environment variables for all secrets**
3. **Rotate secrets regularly (quarterly minimum)**
4. **Use different secrets for each environment**
5. **Monitor for exposed secrets in logs**

## 🔄 SECRET ROTATION SCHEDULE

| Secret | Rotation Frequency | Last Rotated | Next Rotation |
|--------|-------------------|--------------|---------------|
| JWT_SECRET | Every 90 days | 2025-01-09 | 2025-04-09 |
| GEMINI_API_KEY | Every 180 days | TBD | TBD |
| Database Passwords | Every 180 days | TBD | TBD |

## 🎯 ENVIRONMENT-SPECIFIC SECRETS

### Development (.env)
```bash
JWT_SECRET=JDrpHPHR16C6lgljx5VEQmf+Mzei3foIFcWKC1sSFFw=
GEMINI_API_KEY=your_dev_gemini_api_key
POSTGRES_PASSWORD=dev_password_123
```

### Production (.env.production)
```bash
JWT_SECRET=<generate_new_secret_for_production>
GEMINI_API_KEY=<production_gemini_api_key>
POSTGRES_PASSWORD=<strong_production_password>
ALLOWED_ORIGINS=https://pessoa.theater
```

## 🔍 MONITORING AND ALERTS

Set up monitoring for:
- Failed JWT token validations (potential attacks)
- Unusual API usage patterns
- Database connection attempts
- Secret rotation reminders

## 🚨 INCIDENT RESPONSE

If secrets are compromised:
1. **Immediately rotate all affected secrets**
2. **Revoke old secrets from all services**
3. **Check logs for unauthorized access**
4. **Update all applications with new secrets**
5. **Monitor for unusual activity**

---

**Last Updated**: 2025-01-09
**Next Review**: 2025-04-09 