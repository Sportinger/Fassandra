# 🔍 Pessoa API Reference

Complete API documentation for the Pessoa collaborative scriptwriting platform.

## 🚀 Quick Start

### Base URL
```
https://your-domain.com
```

### Authentication
```bash
# Login to get JWT token
curl -X POST https://your-domain.com/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pessoa.de","password":"PassoaDevteam"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-domain.com/api/scripts
```

## 📋 API Endpoints Overview

### 🔐 Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/login` | User authentication |
| `POST` | `/register` | User registration |

### 📄 Script Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/scripts` | List user's scripts |
| `POST` | `/api/scripts` | Create new script |
| `GET` | `/api/scripts/{id}` | Get script with blocks |
| `PATCH` | `/api/scripts/{id}` | Update script title |
| `DELETE` | `/api/scripts/{id}` | Delete script |

### 📝 Block Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scripts/{id}/blocks` | Create new block |
| `PATCH` | `/api/blocks/{id}` | Update block content |
| `DELETE` | `/api/blocks/{id}` | Delete block |
| `GET` | `/api/blocks/{id}/history` | Get block edit history |

### 📤 File Upload & AI Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/s/upload` | Upload .docx files |
| `POST` | `/api/s/create_script_from_parsed` | Create script from AI analysis |
| `POST` | `/api/s/thumbnails/generate` | Generate script thumbnails |

### 🤝 Real-time Collaboration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `WS` | `/api/collab/{script_id}` | Real-time collaboration |
| `POST` | `/api/scripts/{id}/content-snapshot` | Store content snapshot |

### 🔧 System & Debugging

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System health check |
| `POST` | `/api/debug/console-logs` | Mobile console forwarding |

## 🔐 Authentication API

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
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com", 
    "username": "username",
    "role": "user"
  }
}
```

### Register
```http
POST /register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "securepassword"
}
```

## 📄 Scripts API

### List Scripts
```http
GET /api/scripts
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "script-uuid",
    "title": "My Amazing Script",
    "created_by": "user-uuid",
    "created_at": "2025-01-29T10:00:00Z",
    "is_public": false,
    "thumbnail": "data:image/png;base64,..."
  }
]
```

### Create Script
```http
POST /api/scripts
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "New Script Title"
}
```

### Get Script with Blocks
```http
GET /api/scripts/{script_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "script": {
    "id": "script-uuid",
    "title": "Script Title",
    "created_by": "user-uuid",
    "created_at": "2025-01-29T10:00:00Z",
    "is_public": false
  },
  "blocks": [
    {
      "id": "block-uuid",
      "script_id": "script-uuid",
      "block_type": "dialogue",
      "content": "<p>Character dialogue content</p>",
      "created_at": "2025-01-29T10:00:00Z"
    }
  ]
}
```

## 📤 Upload API

### Upload Script File
```http
POST /api/s/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

scriptFile: [.docx file]
```

**Response:**
```json
{
  "title": "Extracted Script Title",
  "speaker": "Character Name",
  "description": "Script description",
  "reading_text": "Full extracted content..."
}
```

### Create Script from Parsed Data
```http
POST /api/s/create_script_from_parsed
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Script Title",
  "speaker": "Main Character",
  "description": "Script description",
  "reading_text": "Full script content..."
}
```

## 🤝 Collaboration API

### WebSocket Connection
```javascript
// Connect to real-time collaboration
const ws = new WebSocket(
  `wss://your-domain.com/api/collab/${scriptId}?token=${jwtToken}`
);

// YJS WebSocket Provider
const provider = new WebsocketProvider(
  'wss://your-domain.com/api/collab',
  scriptId,
  ydoc,
  { params: { token: jwtToken } }
);
```

### Store Content Snapshot
```http
POST /api/scripts/{script_id}/content-snapshot
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "<p>Full script HTML content...</p>",
  "format": "html"
}
```

## 🚨 Error Responses

### Standard Error Format
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UPLOAD_ERROR` | 400 | File upload failed |
| `AI_ANALYSIS_ERROR` | 500 | AI processing failed |

## 📊 Rate Limiting

### API Limits
- **General API**: 1000 requests/hour per user
- **Upload API**: 10 uploads/hour per user
- **WebSocket**: No limit (connection-based)

### Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1643723400
```

## 🔧 Health Check

### System Health
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-29T10:00:00Z",
  "version": "2.0.0",
  "services": {
    "database": "healthy",
    "ai_service": "healthy",
    "websocket": "healthy"
  }
}
```

## 📱 Mobile API Considerations

### Console Log Forwarding
```http
POST /api/debug/console-logs
Authorization: Bearer {token}
Content-Type: application/json

{
  "level": "error",
  "message": "WebSocket connection failed",
  "timestamp": "2025-01-29T10:00:00Z",
  "user_agent": "Mobile browser info",
  "url": "current page URL"
}
```

### Mobile-Specific Headers
```http
X-Mobile-Device: true
X-User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS...)
X-Viewport: 375x667
```

## 🔒 Security Headers

### Required Headers
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

### CORS Headers
```http
Access-Control-Allow-Origin: https://your-domain.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
```

## 📚 SDK & Libraries

### JavaScript/TypeScript
```javascript
// Official Pessoa API client (coming soon)
import { PessoaClient } from '@pessoa/api-client';

const client = new PessoaClient({
  baseURL: 'https://your-domain.com',
  token: 'your-jwt-token'
});

const scripts = await client.scripts.list();
```

### cURL Examples
```bash
# Get all scripts
curl -H "Authorization: Bearer TOKEN" \
  https://your-domain.com/api/scripts

# Upload script
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -F "scriptFile=@script.docx" \
  https://your-domain.com/api/s/upload
```

## 🔍 Testing

### API Testing Tools
- **Postman Collection**: [Download here](../reference/postman-collection.json)
- **OpenAPI Spec**: [Download here](../reference/openapi.yaml)
- **Insomnia Collection**: [Download here](../reference/insomnia-collection.json)

### Test Endpoints
```bash
# Development server
https://localhost:8080/api

# Production server  
https://your-domain.com/api
```

---

**API Version**: v2.0  
**Last Updated**: January 2025  
**Status**: ✅ Stable  
**Documentation**: Complete 