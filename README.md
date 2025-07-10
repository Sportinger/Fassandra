# Pessoa: AI-Powered Collaborative Scriptwriting Platform

<img src="doc/images/pessoa-logo.png" alt="Pessoa Logo" width="200"/>

**Pessoa** is a real-time collaborative scriptwriting platform designed specifically for theater professionals. Write together, edit simultaneously, and let AI help structure your scripts.

## ✨ Key Features

- **🤝 Real-time Collaboration**: Multiple users editing simultaneously with live cursor tracking
- **🤖 AI Script Analysis**: Upload `.docx` files and get instant script structure analysis
- **📱 Mobile-First Design**: Works seamlessly on all devices and screen sizes
- **🔒 Secure & Private**: JWT authentication with role-based access control
- **⚡ Lightning Fast**: Sub-second sync with automatic conflict resolution
- **🎭 Theater-Focused**: Built specifically for theater scripts and production workflows

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- 4GB+ RAM recommended

### 1. Get Started in 2 Minutes

```bash
# Clone the repository
git clone <your-repo-url>
cd pessoa

# Copy environment template
cp env.example .env

# Start the platform
docker compose up -d

# Access the application
# 🌐 Web: https://localhost:8080
# 🔧 Admin: http://localhost:5050 (pgAdmin)
```

### 2. First Login

Default development credentials:
- **Email**: `admin@pessoa.de`
- **Password**: `PassoaDevteam`

### 3. Upload Your First Script

1. Click "Upload Script" 
2. Select a `.docx` file
3. Watch AI analyze and structure your content
4. Start collaborating in real-time!

## 📚 Complete Documentation

| Section | Description |
|---------|-------------|
| **[📖 User Guide](doc/getting-started/README.md)** | Complete setup and usage instructions |
| **[🚀 Deployment Guide](doc/deployment/README.md)** | Production deployment on Hetzner, AWS, etc. |
| **[🔧 Development Guide](doc/development/README.md)** | Contributing, development setup, architecture |
| **[🔒 Security Guide](doc/security/README.md)** | Security implementation and best practices |
| **[🔍 API Reference](doc/api/README.md)** | Complete API documentation |
| **[🛠️ Troubleshooting](doc/troubleshooting/README.md)** | Common issues and solutions |

## 🏗️ Architecture

```
Browser (HTTPS) → Nginx Frontend → Rust Backend → PostgreSQL
                                ↓
                         WebSocket Server
```

**Tech Stack:**
- **Frontend**: React 18 + TypeScript + TipTap Editor + YJS
- **Backend**: Rust + Axum + SQLx + Tokio
- **Database**: PostgreSQL 15 + Redis (sessions)
- **Real-time**: WebSocket + YJS CRDTs
- **AI**: Google Gemini API
- **Infrastructure**: Docker + Nginx + SSL/TLS

## 🤝 Contributing

We welcome contributions! See our [Development Guide](doc/development/README.md) for:
- Setting up development environment
- Code style and standards
- Testing procedures
- Submission process

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **📖 Documentation**: [Complete Manual](doc/README.md)
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-org/pessoa/issues)
- **💬 Community**: [Discord Server](https://discord.gg/your-invite)
- **📧 Email**: support@pessoa.theater

---

**Made with ❤️ for the theater community**
