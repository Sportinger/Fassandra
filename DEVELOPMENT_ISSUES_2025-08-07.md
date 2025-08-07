# Development Environment Issues - August 7, 2025

## Problem Summary

After rebuilding the development Docker containers, two critical issues prevented the application from working:

1. **Rust Compilation Failure**: Backend wouldn't compile due to a dependency requiring Rust edition 2024
2. **Authentication Failure**: Frontend couldn't authenticate with backend despite successful login

## Issue 1: Rust Edition 2024 Dependency Problem

### Root Cause
The `base64ct` crate version 1.8.0 was recently released and requires Rust edition 2024, which isn't available in stable Rust (1.82.0 or 1.83.0). This crate is a transitive dependency pulled in by:
- `argon2` (password hashing)
- `password-hash`
- `pem-rfc7468`
- `spki`

### Error Message
```
error: failed to parse manifest at `/usr/local/cargo/registry/src/index.crates.io-6f17d22bba15001f/base64ct-1.8.0/Cargo.toml`

Caused by:
  feature `edition2024` is required
  The package requires the Cargo feature called `edition2024`, but that feature is not stabilized in this version of Cargo (1.82.0)
```

### Solution Applied
Added explicit dependency pinning in `backend/Cargo.toml`:
```toml
# Pin base64ct to avoid Rust edition 2024 requirement
base64ct = "=1.6.0"
```

This prevents Cargo from automatically updating to the incompatible version.

## Issue 2: Authentication Cookie Problem

### Root Cause
The authentication system uses httpOnly cookies with the `secure` flag set to `true`, requiring HTTPS. However:
- Frontend runs on HTTPS (`https://192.168.2.111:8080`)
- Backend runs on HTTP (`http://backend:3000`)
- Vite dev server proxies requests from HTTPS to HTTP

With `secure=true`, cookies couldn't be set over the proxied HTTP connection, causing authentication to fail after login.

### Solution Applied
Made cookie settings environment-aware in `backend/src/auth/cookies.rs`:

```rust
/// Check if we're in production mode
fn is_production() -> bool {
    std::env::var("PRODUCTION").is_ok() || 
    std::env::var("RUST_ENV").unwrap_or_default() == "production"
}

// In cookie settings:
.secure(is_production()) // Secure in production, non-secure in dev
```

This allows:
- **Development**: `secure=false` - cookies work over proxied HTTP
- **Production**: `secure=true` - maintains security requirements

## Files Modified

1. **backend/Cargo.toml**
   - Added `base64ct = "=1.6.0"` to pin the dependency

2. **backend/src/auth/cookies.rs**
   - Added `is_production()` function
   - Updated all cookie builders to use `secure(is_production())`
   - Changed CSRF cookie SameSite from Strict to Lax in development

3. **frontend/vite.config.dev.ts**
   - Added proxy configuration handlers to properly forward cookies

## Current Architecture

```
Browser (HTTPS) → Vite Dev Server (HTTPS :8080) → Proxy → Backend (HTTP :3000)
```

This is the standard development setup used by most modern frameworks:
- Frontend needs HTTPS for browser APIs (audio, video, etc.)
- Backend uses HTTP internally (Docker network is isolated)
- Proxy handles the HTTPS→HTTP translation

## Testing the Fix

1. Backend now compiles successfully with Rust 1.82.0
2. Login works at `https://192.168.2.111:8080`
3. Cookies are properly set and authentication persists
4. API requests include authentication cookies

## Important Notes

- **DO NOT** use `secure(false)` in production - it's a security vulnerability
- **DO NOT** upgrade to `base64ct` 1.8.0 until Rust edition 2024 is stable
- The environment-aware cookie settings ensure dev works while production remains secure

## Test Credentials

- Email: `a@b.c`
- Password: `a@b.d123abCD`