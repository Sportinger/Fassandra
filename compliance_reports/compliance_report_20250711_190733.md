## Backend Dependencies (Rust)
### Cargo.toml Analysis
```toml
[package]
name = "backend"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = { version = "0.7.5", features = ["macros", "ws", "multipart"] }
serde = { version = "1.0.204", features = ["derive"] }
serde_json = "1.0.120"
uuid = { version = "1.8", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde", "clock"] }
sqlx = { version = "0.7.4", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "macros"] }
sqlx-cli = { version = "0.7.4", features = ["native-tls", "postgres"] }
dotenvy = "0.15"
tracing-subscriber = { version = "0.3", features = ["fmt", "env-filter"] }
tower = { version = "0.4.13", features = ["full"] }
tower-http = { version = "0.5.2", features = ["cors", "trace", "limit"] }
thiserror = "1.0"
jsonwebtoken = "9"
tokio = { version = "1", features = ["full"] }
argon2 = "0.5"
validator = { version = "0.16", features = ["derive"] }
regex = "1.10"
lazy_static = "1.4"
anyhow = "1.0.81"
tracing = "0.1"
serde_qs = "0.12"
docx-rs = "0.4.17"
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
async-trait = "0.1"
tokio-tungstenite = "0.24"
url = "2.5"
futures-util = "0.3"
once_cell = "1.19"
dashmap = "5.5"
rand = "0.8"
urlencoding = "2.1.3"
base64 = "0.22.1"
html-escape = "0.2"
yrs = { version = "0.24.0", features = ["sync"] }
hex = "0.4.3"

# Added for to_string_lossy suggestion
rustix = "0.38"

[[bin]]
name = "hash_password"
path = "scripts/hash_password.rs"

[dev-dependencies]
tokio-test = "0.4"
futures = "0.3"
mockall = "0.12"
```

## Frontend Dependencies (Node.js)
### package.json Analysis
```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/material": "^7.0.2",
    "@tiptap/extension-collaboration": "^2.11.9",
    "@tiptap/extension-collaboration-cursor": "^2.11.9",
    "@tiptap/extension-color": "^2.11.9",
    "@tiptap/extension-heading": "^2.11.9",
    "@tiptap/extension-text-align": "^2.11.9",
    "@tiptap/extension-text-style": "^2.11.9",
    "@tiptap/react": "^2.11.9",
    "@tiptap/starter-kit": "^2.11.9",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "uuid": "^11.1.0",
    "vite-plugin-pwa": "^1.0.0",
    "y-indexeddb": "^9.0.12",
    "y-webrtc": "^10.3.0",
    "y-websocket": "^3.0.0",
    "yjs": "^13.6.26"
  },
  "devDependencies": {
    "@eslint/js": "^9.22.0",
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^14.3.1",
    "@types/jest": "^29.5.14",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/ws": "^8.18.1",
    "@vitejs/plugin-react": "^4.3.4",
    "@vitest/coverage-v8": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "eslint": "^9.22.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.19",
    "globals": "^16.0.0",
    "jsdom": "^24.0.0",
    "typescript": "~5.7.2",
    "typescript-eslint": "^8.26.1",
    "vite": "^6.3.1",
    "vitest": "^1.0.0",
    "ws": "^8.18.2"
  }
}
```

## License Analysis
### ⚠️ WARNING: No LICENSE file found
### License Mentions in Code
```
No license mentions found in code
```

## Dependency License Analysis
### Frontend Package Licenses
```
    760 "license": "MIT"
     35 "license": "ISC"
     22 "license": "Apache-2.0"
     17 "license": "BSD-3-Clause"
     14 "license": "BSD-2-Clause"
      1 "license": "Python-2.0"
      1 "license": "(MIT OR CC0-1.0)"
      1 "license": "MIT-0"
      1 "license": "CC-BY-4.0"
      1 "license": "(AFL-2.1 OR BSD-3-Clause)"
```

## Code Similarity Analysis
### Potential Code Patterns
```
No external references in TODO comments
```

## Recommendations

✅ MIT License declared in README.md

### Next Steps for Complete Compliance

1. **Create LICENSE file** if missing
2. **Use professional tools** for deeper analysis:
   - Copyleaks for code plagiarism detection
   - FOSSA for comprehensive license compliance
   - FOSSology (free) for basic license scanning
3. **Review all dependencies** for license compatibility
4. **Generate Software Bill of Materials (SBOM)**
5. **Implement continuous compliance monitoring**
