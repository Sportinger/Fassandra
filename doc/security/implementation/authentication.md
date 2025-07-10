# 🔐 Authentication System Implementation

## Overview

The Pessoa Theater platform implements a robust JWT-based authentication system with Argon2 password hashing, providing enterprise-grade security for user authentication and session management.

## 🛡️ Security Features

### Password Security
- **Hashing Algorithm:** Argon2id (industry standard)
- **Salt Generation:** Cryptographically secure random salts
- **Password Validation:** Secure timing-resistant verification
- **No Plaintext Storage:** Passwords never stored in plain text

### JWT Token Management
- **Algorithm:** HMAC SHA-256 (HS256)
- **Token Expiration:** 24 hours
- **Secret Management:** Environment variable based
- **Claims Structure:** User ID, email, username, role, expiration

## 🏗️ Architecture

### Authentication Flow
```
1. User Registration/Login Request
   ↓
2. Password Validation (Argon2)
   ↓
3. JWT Token Generation
   ↓
4. Token Return to Client
   ↓
5. Client Stores Token
   ↓
6. Token Sent with Requests (Authorization Header)
   ↓
7. Server Validates Token
   ↓
8. Request Processing/Rejection
```

### Components

#### 1. Password Hashing (`hash_password`)
```rust
pub fn hash_password(password: &str) -> Result<String>
```
- Uses Argon2id with secure parameters
- Generates random salt for each password
- Returns salted hash for database storage

#### 2. Password Verification (`verify_password`)
```rust
pub fn verify_password(password: &str, hash: &str) -> bool
```
- Timing-resistant verification
- Extracts salt from stored hash
- Compares against provided password

#### 3. JWT Token Generation (`generate_token`)
```rust
pub fn generate_token(user_id: Uuid, email: &str, username: &str, role: &str) -> Result<String>
```
- Creates JWT with user claims
- 24-hour expiration
- HMAC SHA-256 signing

#### 4. JWT Token Verification (`verify_token`)
```rust
pub fn verify_token(token: &str) -> Result<Claims>
```
- Validates token signature
- Checks expiration
- Returns user claims

## 🔧 Implementation Details

### Registration Handler
```rust
async fn register(State(pool): State<Arc<PgPool>>, Json(payload): Json<RegisterPayload>) -> Result<Json<String>, AppError>
```

**Process:**
1. Validate input data (email format, username requirements, password strength)
2. Check for existing user with same email
3. Hash password using Argon2
4. Store user in database
5. Generate JWT token
6. Return token to client

**Security Measures:**
- Input validation using `validator` crate
- Unique email constraint in database
- Secure password hashing
- Proper error handling

### Login Handler
```rust
async fn login(State(pool): State<Arc<PgPool>>, Json(payload): Json<LoginPayload>) -> Result<Json<String>, AppError>
```

**Process:**
1. Validate input format
2. Retrieve user by email
3. Verify password against stored hash
4. Generate new JWT token
5. Return token to client

**Security Measures:**
- Timing-resistant password verification
- Generic error messages (no user enumeration)
- Rate limiting protection
- Secure token generation

### Authentication Middleware (`AuthUser`)
```rust
impl<S> FromRequestParts<S> for AuthUser
```

**Process:**
1. Extract Authorization header
2. Validate Bearer token format
3. Verify JWT token
4. Extract user claims
5. Provide user context to handlers

**Security Features:**
- Automatic token validation
- Proper error responses
- No token details in error messages

### WebSocket Authentication (`WsAuthUser`)
```rust
impl<S> FromRequestParts<S> for WsAuthUser
```

**Process:**
1. Extract token from query parameters
2. Handle Bearer prefix variations
3. Verify JWT token
4. Provide user context for WebSocket connections

**Special Handling:**
- Query parameter token extraction
- Chrome WebSocket compatibility
- Proper error responses for WebSocket upgrades

## ⚙️ Configuration

### Environment Variables
```bash
# JWT Secret (REQUIRED)
JWT_SECRET=your-super-secure-jwt-secret-here

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost/database
```

### JWT Configuration
- **Algorithm:** HS256 (HMAC SHA-256)
- **Expiration:** 24 hours
- **Claims:** sub (user_id), exp, email, username, role

### Argon2 Parameters
- **Variant:** Argon2id
- **Memory Cost:** Default (secure)
- **Time Cost:** Default (secure)
- **Parallelism:** Default

## 🚨 Security Considerations

### Password Security
- **Minimum Length:** 8 characters (configurable)
- **Storage:** Never stored in plaintext
- **Hashing:** Argon2id with random salts
- **Verification:** Timing-resistant comparisons

### Token Security
- **Secret Management:** Environment variables only
- **Token Expiration:** 24-hour maximum
- **Signature Verification:** Always validated
- **Error Handling:** No sensitive information disclosure

### Rate Limiting
- **Login Attempts:** Protected by rate limiting middleware
- **Token Validation:** Efficient to prevent DoS
- **Error Responses:** Generic messages to prevent enumeration

## 🧪 Testing

### Test Coverage
- ✅ User registration with valid data
- ✅ User login with valid credentials
- ✅ Failed login with invalid credentials
- ✅ JWT token generation and validation
- ✅ Password hashing and verification
- ✅ Rate limiting on authentication endpoints

### Security Tests
- ✅ No password plaintext storage
- ✅ Secure password hashing
- ✅ JWT token validation
- ✅ Authorization header processing
- ✅ WebSocket token authentication

## 📋 API Endpoints

### Registration
```http
POST /register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "securepassword"
}
```

**Response:**
```json
"jwt.token.here"
```

### Login
```http
POST /login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
"jwt.token.here"
```

### Authenticated Requests
```http
GET /api/scripts
Authorization: Bearer jwt.token.here
```

### WebSocket Authentication
```
ws://localhost:3001/api/collab/script-id?token=jwt.token.here
```

## 🔄 Token Lifecycle

### Token Generation
1. User provides valid credentials
2. System verifies credentials
3. JWT created with user claims
4. Token signed with secret
5. Token returned to client

### Token Usage
1. Client includes token in Authorization header
2. Server extracts and validates token
3. User identity established from claims
4. Request processed with user context

### Token Expiration
1. Token expires after 24 hours
2. Client receives 401 Unauthorized
3. Client must re-authenticate
4. New token issued upon successful login

## 🚀 Best Practices

### Implementation
- Always validate JWT tokens on protected endpoints
- Use environment variables for secrets
- Implement proper error handling
- Log authentication events (without sensitive data)

### Security
- Rotate JWT secrets regularly
- Monitor for unusual authentication patterns
- Implement account lockout for repeated failures
- Use HTTPS for all authentication endpoints

### Performance
- Cache JWT validation results when appropriate
- Use efficient password hashing parameters
- Implement proper database indexing for user lookups

---

**Implementation Status:** ✅ PRODUCTION READY  
**Security Level:** ENTERPRISE GRADE  
**Last Updated:** January 29, 2025 