# 📚 Pessoa Complete Manual

Welcome to the comprehensive documentation for **Pessoa**, the AI-powered collaborative scriptwriting platform designed specifically for theater professionals.

## 🎭 About Pessoa

Pessoa transforms theater script development by providing a real-time collaborative platform where writers, directors, and entire production teams can work together seamlessly. With AI-powered script analysis and instant synchronization, Pessoa keeps everyone on the same page—literally.

## 📖 Manual Contents

### 🚀 Getting Started
Essential guides to get you up and running quickly.

| Guide | Description |
|-------|-------------|
| **[Quick Start](getting-started/README.md)** | Set up Pessoa in 5 minutes |
| **[Installation Guide](getting-started/installation.md)** | Complete setup instructions |
| **[First Steps](getting-started/first-steps.md)** | Upload your first script and start collaborating |
| **[User Guide](getting-started/user-guide.md)** | Complete walkthrough of all features |
| **[Mobile Setup](getting-started/mobile-setup.md)** | Mobile browser configuration and debugging |

### 🚀 Deployment
Production-ready deployment guides for various platforms.

| Guide | Description |
|-------|-------------|
| **[Deployment Overview](deployment/README.md)** | Choose your deployment strategy |
| **[Hetzner Deployment](deployment/hetzner.md)** | Deploy on Hetzner Cloud (recommended) |
| **[AWS Deployment](deployment/aws.md)** | Deploy on Amazon Web Services |
| **[Custom Domain Setup](deployment/custom-domain.md)** | Configure your own domain |
| **[SSL/TLS Configuration](deployment/ssl-setup.md)** | Set up secure connections |
| **[GitHub Actions CI/CD](deployment/github-actions.md)** | Automated deployments |

### 🔧 Development
Contributing to Pessoa and extending functionality.

| Guide | Description |
|-------|-------------|
| **[Development Setup](development/README.md)** | Set up your development environment |
| **[Contributing Guide](development/contributing.md)** | How to contribute to Pessoa |
| **[Code Style Guide](development/code-style.md)** | Coding standards and conventions |
| **[Testing Guide](development/testing.md)** | Running and writing tests |
| **[Architecture Deep Dive](development/architecture.md)** | Technical architecture overview |

### 🏗️ Architecture
Technical documentation for understanding Pessoa's inner workings.

| Guide | Description |
|-------|-------------|
| **[System Architecture](architecture/README.md)** | High-level system overview |
| **[Frontend Architecture](architecture/frontend.md)** | React + TypeScript + TipTap + YJS |
| **[Backend Architecture](architecture/backend.md)** | Rust + Axum + PostgreSQL |
| **[Real-time Collaboration](architecture/collaboration.md)** | WebSocket + YJS implementation |
| **[AI Integration](architecture/ai-integration.md)** | Google Gemini API integration |
| **[Database Schema](architecture/database.md)** | PostgreSQL schema documentation |

### 🔍 API Reference
Complete API documentation for integrations and custom development.

| Guide | Description |
|-------|-------------|
| **[API Overview](api/README.md)** | API structure and authentication |
| **[Authentication API](api/auth.md)** | Login, registration, JWT tokens |
| **[Scripts API](api/scripts.md)** | Script management endpoints |
| **[Collaboration API](api/collaboration.md)** | WebSocket and real-time features |
| **[Upload API](api/upload.md)** | File upload and AI analysis |
| **[Admin API](api/admin.md)** | Administrative endpoints |

### 🔒 Security
Security implementation and best practices.

| Guide | Description |
|-------|-------------|
| **[Security Overview](security/README.md)** | Security architecture and policies |
| **[Authentication](security/implementation/authentication.md)** | JWT and password security |
| **[Security Headers](security/implementation/security-headers.md)** | HTTP security headers |
| **[Environment Variables](security/configuration/environment-variables.md)** | Secure configuration management |
| **[Security Testing](security/testing/security-test-suite.md)** | Automated security testing |
| **[Audit Reports](security/audit-reports/)** | Security audit results |

### 🛠️ Troubleshooting
Common issues and solutions.

| Guide | Description |
|-------|-------------|
| **[Common Issues](troubleshooting/README.md)** | Frequent problems and solutions |
| **[WebSocket Issues](troubleshooting/websocket.md)** | Real-time collaboration problems |
| **[Mobile Browser Issues](troubleshooting/mobile.md)** | Mobile-specific troubleshooting |
| **[SSL/HTTPS Issues](troubleshooting/ssl.md)** | Certificate and connection problems |
| **[Performance Issues](troubleshooting/performance.md)** | Optimization and debugging |
| **[Database Issues](troubleshooting/database.md)** | PostgreSQL troubleshooting |

### 📋 Reference
Additional resources and references.

| Guide | Description |
|-------|-------------|
| **[Configuration Reference](reference/configuration.md)** | All environment variables and settings |
| **[Command Reference](reference/commands.md)** | Docker commands and scripts |
| **[Troubleshooting Tools](reference/debugging-tools.md)** | Debug utilities and monitoring |
| **[FAQ](reference/faq.md)** | Frequently asked questions |
| **[Glossary](reference/glossary.md)** | Terms and definitions |

## 🎯 Quick Navigation

### New to Pessoa?
1. **[Quick Start](getting-started/README.md)** - Get running in 5 minutes
2. **[First Steps](getting-started/first-steps.md)** - Upload and collaborate
3. **[User Guide](getting-started/user-guide.md)** - Complete feature walkthrough

### Ready for Production?
1. **[Deployment Overview](deployment/README.md)** - Choose your platform
2. **[Hetzner Deployment](deployment/hetzner.md)** - Recommended cloud deployment
3. **[SSL Setup](deployment/ssl-setup.md)** - Secure your installation

### Want to Contribute?
1. **[Development Setup](development/README.md)** - Set up your dev environment
2. **[Contributing Guide](development/contributing.md)** - How to contribute
3. **[Architecture](development/architecture.md)** - Understand the codebase

### Having Issues?
1. **[Common Issues](troubleshooting/README.md)** - Check frequent problems
2. **[WebSocket Issues](troubleshooting/websocket.md)** - Real-time collaboration
3. **[Mobile Issues](troubleshooting/mobile.md)** - Mobile browser problems

## 🔄 Recent Updates

### Version 2.0.0 - Enhanced Upload Experience
- **Detailed Upload Progress**: 11-stage upload process with real-time feedback
- **Background Upload Processing**: Upload and continue working
- **Enhanced Error Handling**: Comprehensive error reporting and retry logic
- **Mobile Optimization**: Improved mobile browser compatibility

### Version 1.9.0 - Real-time Collaboration
- **Fixed Editor Crashes**: Resolved infinite re-rendering issues
- **User Counter**: Live user count in collaboration sessions
- **WebSocket Improvements**: Better connection handling and reconnection
- **Mobile Debugging**: Advanced mobile browser debugging tools

### Version 1.8.0 - Architecture Refactoring
- **Modular Editor**: Complete editor refactoring with TypeScript
- **Responsive Design**: DIN A4 proportional scaling across all devices
- **Mobile-First**: Optimized for mobile browsers and touch interfaces
- **Performance**: Significant performance improvements and memory optimization

## 🤝 Community

- **GitHub**: [Pessoa Repository](https://github.com/your-org/pessoa)
- **Discord**: [Community Server](https://discord.gg/your-invite)
- **Email**: support@pessoa.theater
- **Website**: [pessoa.theater](https://pessoa.theater)

## 📝 Contributing to Documentation

Found an issue with the documentation? Want to add a guide?

1. **Report Issues**: [GitHub Issues](https://github.com/your-org/pessoa/issues)
2. **Suggest Improvements**: Create a pull request
3. **Add Content**: Follow our [Documentation Style Guide](development/documentation-style.md)

---

**Last Updated**: January 2025  
**Version**: 2.0.0  
**Status**: ✅ Complete and Up-to-Date 