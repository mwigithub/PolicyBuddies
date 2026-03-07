# PolicyBuddies

An AI-powered **insurance Q&A assistant** with REST API for web integration.

PolicyBuddies provides:
- 🤖 Intelligent Q&A using LLM + retrieval-augmented generation
- 🔌 REST API for web/mobile integration (`npm run api`)
- 📱 Terminal UI for direct use (`npm run tui:ask`)
- 📄 PDF ingestion with intelligent document processing
- 🎯 Product metadata + intent routing with guardrails
- 🚀 Production-ready with 6 deployment options

---

## 📚 Quick Links

### 🚀 Getting Started
- **New to PolicyBuddies?** → [📖 Main Documentation Index](./docs/README.md)
- **Want to use the API?** → [⚡ 5-minute Quick Start](./docs/api/QUICKSTART.md)
- **Need deployment?** → [🚀 Deployment Guide](./docs/deployment/README.md)
- **Designing UI?** → [🎨 Design Specification](./docs/design/DESIGN-SPEC.md)

### 📖 Documentation Structure
```
docs/
├── README.md              ← 📚 Main documentation index
├── api/                   ← 🔌 API documentation
│   ├── QUICKSTART.md      (5-minute start)
│   ├── REFERENCE.md       (developer reference)
│   └── API.md            (full spec)
├── deployment/            ← 🚀 Deployment guides
│   └── DEPLOYMENT.md     (6 platforms)
├── design/               ← 🎨 UI/UX specification
│   └── DESIGN-SPEC.md    (for Figma)
└── guides/               ← 📚 Architecture & reference
    ├── BUILD-SUMMARY.md
    └── WEB-API-INDEX.md
```

---

## ⚡ Quick Start

### 1. Start the API Server
```bash
npm run api              # Development (auto-reload)
npm run api:prod        # Production
```

### 2. Test the API
```bash
curl http://localhost:3000/api/health
node scripts/api-client.mjs        # Full test suite
python3 scripts/api-client.py     # Python test suite
```

### 3. Use the Terminal UI (Original)
```bash
npm run tui:ask              # Ask questions directly
npm run tui:ingestion        # Ingest documents
npm run tui:llm-config       # Configure LLM
```

---

## 🎯 Choose Your Path

| I want to... | Go to... | Time |
|---|---|---|
| **Use the API** | [API Quick Start](./docs/api/QUICKSTART.md) | 5 min |
| **Deploy to production** | [Deployment Guide](./docs/deployment/README.md) | 20 min |
| **Design the UI** | [Design Spec](./docs/design/DESIGN-SPEC.md) | 30 min |
| **Understand architecture** | [Build Summary](./docs/guides/BUILD-SUMMARY.md) | 15 min |
| **Find everything** | [Documentation Index](./docs/README.md) | Reference |

---

## 🚀 Running Locally

### Prerequisites
- Node.js 20+
- Python 3 (for PDF processing)
- API keys for LLM (Gemini, OpenAI, etc.)

### Setup
```bash
npm install
npm run api              # Start API server
```

### Test
```bash
curl http://localhost:3000/api/health     # Check server
node scripts/api-client.mjs                # Run tests
```

---

## 🔌 API Endpoints

```
GET  /api/health         Check if server is running
GET  /api/catalog        List indexed documents  
GET  /api/config         View configuration
POST /api/ingest         Upload & ingest document
POST /api/ask            Ask insurance question
```

**Full API docs:** [API Documentation](./docs/api/README.md)

---

## 📁 Project Structure

```
PolicyBuddies/
├── src/
│   ├── web/
│   │   └── server.js              ← New REST API
│   ├── qa/                        ← Question answering
│   ├── ingestion/                 ← Document processing
│   ├── agentic/                   ← Agent orchestration
│   ├── chunking/                  ← Text chunking
│   └── config/                    ← Configuration
├── scripts/
│   ├── api-client.mjs             ← JS test client
│   └── api-client.py              ← Python test client
├── docs/                          ← 📚 Full documentation
├── Dockerfile                     ← Docker image
├── package.json                   ← Dependencies
└── config/
    ├── runtime.json               ← Runtime config
    └── llm-modules.json           ← LLM config
```

---

## 🛠️ Available Commands

### API Server
```bash
npm run api              # Development (with auto-reload)
npm run api:dev         # Same as above
npm run api:prod        # Production mode
```

### Terminal UIs
```bash
npm run tui:ask              # Ask questions interactively
npm run tui:ingestion        # Ingest documents
npm run tui:llm-config       # Configure LLM settings
```

### Testing
```bash
node scripts/api-client.mjs       # JavaScript test suite
python3 scripts/api-client.py    # Python test suite
```

### Original Entrypoint
```bash
npm start                # Run main application
```

---

## 🌍 Deployment Options

Deploy with one of 6 platforms:

| Platform | Cost | Setup Time | Best For |
|----------|------|-----------|----------|
| **DigitalOcean** | $4–6/mo | 20 min | POC, small projects |
| **Railway** | $5–15/mo | 5 min | Developers, auto-deploy |
| **Oracle Cloud** | FREE | 30 min | Long-term, no costs |
| **AWS** | $17–30/mo | 30 min | Enterprise, scaling |
| **Local SSH** | $0 | 30 min | Testing, team access |
| **Docker** | $0 | 10 min | Development |

**→ [Deployment Guide](./docs/deployment/README.md)** for step-by-step setup

---

## 🔐 Setup

### 1. Environment Variables
```bash
# .env or export
GEMINI_API_KEY=your-api-key
OPENAI_API_KEY=your-api-key (optional)
NODE_ENV=development
PORT=3000
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start API
```bash
npm run api
```

### 4. Verify
```bash
curl http://localhost:3000/api/health
```

---

## 📚 Configuration Files

| File | Purpose |
|------|---------|
| `config/runtime.json` | Runtime settings |
| `config/llm-modules.json` | LLM provider config |
| `metadata/runtime/query-routing-policy.json` | Query routing |
| `metadata/runtime/intent-lexicon.json` | Intent keywords |
| `metadata/runtime/formula-product-routing.json` | Product routing |

---

## 📍 Data Paths

```
data/
├── sources/              ← Insurance policy documents
├── extracted-text/       ← Extracted text from PDFs
├── ingestion/
│   └── catalog.json      ← Ingestion metadata
└── vector-store/
    └── vectors.jsonl     ← Vector embeddings
```

---

## 📖 Architecture Documentation

### Original Architecture Docs
- [Application Architecture](./docs/architecture/application-architecture-principles.md)
- [Agentic Architecture](./docs/architecture/agentic-architecture-scaffold.md)
- [Intent Routing](./docs/architecture/intent-routing-typo-tolerant-scaffold.md)
- [Terminal UI Flow](./docs/architecture/terminal-ui-menu-flow.md)

### New API Documentation
- [API Quick Start](./docs/api/QUICKSTART.md)
- [API Reference Card](./docs/api/REFERENCE.md)
- [Full API Spec](./docs/api/API.md)
- [Build Summary](./docs/guides/BUILD-SUMMARY.md)

---

## 🎯 Next Steps

### For Users
1. **Read:** [Quick Start](./docs/api/QUICKSTART.md)
2. **Run:** `npm run api`
3. **Test:** `node scripts/api-client.mjs`

### For DevOps
1. **Review:** [Deployment Guide](./docs/deployment/README.md)
2. **Choose:** Your platform
3. **Deploy:** Follow platform-specific steps

### For Designers
1. **Read:** [Design Specification](./docs/design/DESIGN-SPEC.md)
2. **Open:** Figma
3. **Create:** From wireframes provided

### For Developers
1. **Read:** [API Reference](./docs/api/REFERENCE.md)
2. **Integrate:** With your app
3. **Deploy:** Using guide above

---

## 🔍 Session Notes

- [Session Notes (2026-02-21)](./docs/session-notes/2026-02-21-key-activities.md)

---

## 🤝 Support

- 📖 **Full Documentation:** [docs/README.md](./docs/README.md)
- 🔌 **API Help:** [docs/api/](./docs/api/)
- 🚀 **Deployment Help:** [docs/deployment/](./docs/deployment/)
- 🎨 **Design Help:** [docs/design/](./docs/design/)
- ❓ **FAQ:** [docs/guides/WEB-API-INDEX.md](./docs/guides/WEB-API-INDEX.md#--common-questions)

---

## 📝 License

[Same as original PolicyBuddies]

---

## 🎉 Features Overview

✅ **REST API** - Full web integration  
✅ **6 Deployment Options** - From $0 to enterprise  
✅ **Complete Documentation** - API, deployment, design  
✅ **Test Clients** - JavaScript and Python  
✅ **Docker Ready** - Container deployment  
✅ **Original CLI Preserved** - All original features work  
✅ **Production Ready** - Monitoring, logging, error handling  

---

**🚀 Ready to get started?** → [Main Documentation Index](./docs/README.md)

## Runtime Config

- `config/runtime.json`
- `config/llm-modules.json`
- `metadata/runtime/query-routing-policy.json`
- `metadata/runtime/intent-lexicon.json`
- `metadata/runtime/formula-product-routing.json`

## Source and Data Paths

- Source documents root: `data/sources/`
- Recommended source structure: `data/sources/<insurer>/<insurance-type>/<plan-name>/`
- Example: `data/sources/tokio-marine-life/investment-linked/wealth-pro-ii/`
- Ingestion catalog: `data/ingestion/catalog.json`
- Extracted text: `data/extracted-text/`
- Vector store: `data/vector-store/vectors.jsonl`

## Architecture Docs

- `docs/architecture/application-architecture-principles.md`
- `docs/architecture/agentic-architecture-scaffold.md`
- `docs/architecture/intent-routing-typo-tolerant-scaffold.md`
- `docs/architecture/terminal-ui-menu-flow.md`

## Session Notes

- `docs/session-notes/2026-02-21-key-activities.md`
