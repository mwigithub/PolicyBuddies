# 📚 PolicyBuddies Documentation

Welcome to the PolicyBuddies documentation center! Here you'll find everything you need to understand, deploy, and design the application.

---

## 🚀 Quick Navigation

### For Users Getting Started
👉 **[API Documentation](./api/README.md)** - Learn how to use the API
- 5-minute quick start
- Full API reference
- Code examples
- Integration guide

### For Testing/QA
👉 **[Testing Guide](./guides/TESTING-GUIDE.md)** - Complete test plan
- Quick start testing (5 min)
- 4 testing modes (CLI, API, Component, Eval)
- 3-day test plan
- Troubleshooting

### For DevOps/Infrastructure
👉 **[Deployment Guide](./deployment/README.md)** - Deploy to your platform
- 6 cloud platform options
- Step-by-step setup
- Production checklist
- Troubleshooting

### For Designers/Product
👉 **[Design Specification](./design/README.md)** - UI/UX design specs
- User flows and wireframes
- Component library
- Design system
- Figma integration guide

### For Everyone
👉 **[General Guides](./guides/README.md)** - Architecture and overview
- What was built (features)
- Architecture overview
- How everything works together
- Reference information

---

## 📖 Documentation by Role

### 👨‍💻 Developers

Start with: **[API Quick Start](./api/QUICKSTART.md)** (5 min)

Then read:
1. [API Reference](./api/REFERENCE.md) - Endpoints & examples
2. [API Documentation](./api/API.md) - Full spec
3. [Build Summary](./guides/BUILD-SUMMARY.md) - Architecture
4. [Testing Guide](./guides/TESTING-GUIDE.md) - How to test

### 🧪 QA/Testing Engineers

Start with: **[Testing Guide](./guides/TESTING-GUIDE.md)**

Follow:
- Quick start testing (5 min)
- 4 testing modes
- 3-day test plan
- Troubleshooting guide

### 🎨 Designers/Product Managers

Start with: **[Design Specification](./design/DESIGN-SPEC.md)**

Use for:
- Wireframes and user flows
- Component specifications
- Design system guidelines
- Integration with Figma

### 🚀 DevOps/Infrastructure Teams

Start with: **[Deployment Guide](./deployment/README.md)**

Choose your platform:
- [DigitalOcean](./deployment/DEPLOYMENT.md#digitalocean)
- [Railway](./deployment/DEPLOYMENT.md#railway)
- [AWS](./deployment/DEPLOYMENT.md#aws)
- [Oracle Cloud](./deployment/DEPLOYMENT.md#oracle-cloud)
- [Local/SSH](./deployment/DEPLOYMENT.md#localssh)
- [Docker](./deployment/DEPLOYMENT.md#docker-local)

### 📊 Project Managers/Product

Start with: **[Build Summary](./guides/BUILD-SUMMARY.md)**

Get context:
- Feature overview
- Architecture at a glance
- What's included
- Next steps

---

## 📁 Directory Structure

```
docs/
├── README.md                    ← You are here
├── api/                         ← API Documentation
│   ├── README.md               (API index)
│   ├── QUICKSTART.md           (5-minute start)
│   ├── REFERENCE.md            (Developer reference card)
│   └── API.md                  (Full API spec)
├── deployment/                  ← Deployment Guides
│   ├── README.md               (Deployment index)
│   └── DEPLOYMENT.md           (All 6 platforms)
├── design/                      ← Design Spec
│   ├── README.md               (Design index)
│   └── DESIGN-SPEC.md          (Complete UI/UX spec)
├── guides/                      ← General Guides
│   ├── README.md               (Guides index)
│   ├── BUILD-SUMMARY.md        (What was built)
│   └── WEB-API-INDEX.md        (Comprehensive index)
└── architecture/               ← Original architecture docs
    └── (Original docs preserved)
```

---

## 🎯 Common Tasks

### I want to ask questions via API
→ **[5-minute Quick Start](./api/QUICKSTART.md)**

### I need to deploy this app
→ **[Choose Platform & Deploy](./deployment/README.md)**

### I'm designing the UI in Figma
→ **[Design Specification](./design/DESIGN-SPEC.md)**

### I want to understand the architecture
→ **[Build Summary](./guides/BUILD-SUMMARY.md)**

### I need API endpoint details
→ **[API Reference](./api/REFERENCE.md)**

### I want the complete API spec
→ **[Full API Documentation](./api/API.md)**

---

## 📊 Documentation Overview

| Document | Purpose | Audience | Read Time |
|----------|---------|----------|-----------|
| [API Quick Start](./api/QUICKSTART.md) | Get API running in 5 minutes | Developers | 5 min |
| [API Reference](./api/REFERENCE.md) | Quick endpoint reference card | Developers | 10 min |
| [API Full Spec](./api/API.md) | Complete API documentation | Developers/Integration | 20 min |
| [Deployment Guide](./deployment/README.md) | Deploy to 6 different platforms | DevOps | 30 min |
| [Design Spec](./design/DESIGN-SPEC.md) | UI/UX wireframes and specs | Designers/Product | 30 min |
| [Build Summary](./guides/BUILD-SUMMARY.md) | What was built and why | Product/Managers | 15 min |
| [Index & Reference](./guides/WEB-API-INDEX.md) | Comprehensive index | Everyone | 20 min |

---

## 🔍 Key Information

### Quick API Commands

```bash
# Start API
npm run api              # Development mode
npm run api:prod        # Production mode

# Test API
curl http://localhost:3000/api/health
node scripts/api-client.mjs
python3 scripts/api-client.py

# Deploy (choose one)
docker build -t policybuddies-api .
# Then follow [deployment guide](./deployment/DEPLOYMENT.md)
```

### API Endpoints

```
GET  /api/health    - Server status
GET  /api/catalog   - List documents
GET  /api/config    - View config
POST /api/ingest    - Upload document
POST /api/ask       - Ask question
```

### Key Files

```
src/web/server.js              - API server
scripts/api-client.mjs         - JavaScript test client
scripts/api-client.py          - Python test client
Dockerfile, .dockerignore      - Docker setup
package.json                   - Dependencies + scripts
```

---

## 🛠️ Troubleshooting

### API won't start?
→ See [API Quick Start Troubleshooting](./api/QUICKSTART.md#troubleshooting)

### Deployment issues?
→ See [Deployment Troubleshooting](./deployment/DEPLOYMENT.md#troubleshooting)

### Need design help?
→ See [Design Specification](./design/DESIGN-SPEC.md)

### General questions?
→ See [Comprehensive Index](./guides/WEB-API-INDEX.md#-common-questions)

---

## 📞 Quick Links

- **GitHub:** [PolicyBuddies Repository](https://github.com/) (link to your repo)
- **API Server:** `http://localhost:3000` (when running locally)
- **Health Check:** `curl http://localhost:3000/api/health`

---

## ✅ Documentation Checklist

- [ ] Reviewed [Quick Start](./api/QUICKSTART.md)
- [ ] Got API running locally
- [ ] Tested endpoints with curl or client
- [ ] Read role-specific documentation above
- [ ] Bookmarked [API Reference](./api/REFERENCE.md)
- [ ] Chosen deployment platform
- [ ] Started deployment process

---

## 📝 Document Versions

| Document | Version | Last Updated |
|----------|---------|--------------|
| API Documentation | 1.0 | Mar 7, 2026 |
| API Quick Start | 1.0 | Mar 7, 2026 |
| API Reference | 1.0 | Mar 7, 2026 |
| Deployment Guide | 1.0 | Mar 7, 2026 |
| Design Specification | 1.0 | Mar 7, 2026 |
| Build Summary | 1.0 | Mar 7, 2026 |

---

## 🚀 Next Steps

1. **Find your role above** and start with the recommended document
2. **Get the API running** - [5-minute Quick Start](./api/QUICKSTART.md)
3. **Choose your platform** - [Deployment Guide](./deployment/README.md)
4. **Start building** - Use examples in [API Reference](./api/REFERENCE.md)

---

**Need help?** Check [Comprehensive Index](./guides/WEB-API-INDEX.md) for more details!

Last Updated: March 7, 2026
