# PolicyBuddies API - Developer Reference Card

**Quick access to commands, endpoints, and examples**

---

## ⚡ Quick Commands

```bash
# Start API server
npm run api                 # Development (auto-reload)
npm run api:prod           # Production mode

# Test the API
node scripts/api-client.mjs  # Full test suite (JavaScript)
python3 scripts/api-client.py  # Full test suite (Python)

# Original CLI (still works)
npm run tui:ask            # Ask question terminal UI
npm run tui:ingestion      # Ingestion terminal UI

# Health check
curl http://localhost:3000/api/health
```

---

## 🔌 API Endpoints

### GET Endpoints

#### Health Check
```bash
curl http://localhost:3000/api/health
```
**Response:** Server status, version, LLM provider

#### Get Catalog
```bash
curl http://localhost:3000/api/catalog
```
**Response:** List of indexed documents with metadata

#### Get Configuration
```bash
curl http://localhost:3000/api/config
```
**Response:** Runtime config (planner, orchestration, paths)

---

### POST Endpoints

#### Ingest Document
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "policy.pdf",
    "content": "Document content here...",
    "metadata": {
      "productName": "Product Name",
      "jurisdiction": "SG",
      "versionLabel": "v1",
      "documentType": "product summary"
    }
  }'
```
**Response:** `{ runId, documentVersionId, chunksGenerated, vectorsStored }`

#### Ask Question
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the coverage options?",
    "topK": 3,
    "sessionId": "session_123"
  }'
```
**Response:** `{ answer, confidence, sources, reasoning, orchestration }`

---

## 🔄 Request/Response Examples

### Example: Complete Flow

#### 1. Ingest Document
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "wealth-pro.pdf",
    "content": "Wealth Pro is an investment-linked insurance product...",
    "metadata": {
      "productName": "Wealth Pro II",
      "jurisdiction": "SG",
      "versionLabel": "v1.0",
      "documentType": "product summary"
    }
  }'
```

Response:
```json
{
  "success": true,
  "runId": "run_1234567890",
  "documentVersionId": "doc_v1_abc123",
  "chunksGenerated": 42,
  "vectorsStored": 42
}
```

#### 2. Ask Question
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the investment options in Wealth Pro II?"
  }'
```

Response:
```json
{
  "success": true,
  "question": "What are the investment options in Wealth Pro II?",
  "answer": "Wealth Pro II offers multiple investment options...",
  "confidence": 0.87,
  "sources": [
    {
      "chunk": "investment options...",
      "score": 0.92,
      "document": "Wealth Pro II Product Summary"
    }
  ],
  "reasoning": {
    "detectedIntent": "product_features",
    "clarificationNeeded": false,
    "clarificationQuestions": [],
    "turnCount": 1
  },
  "orchestration": {
    "status": "completed",
    "finalizedAt": "2026-03-07T10:35:12Z"
  }
}
```

---

## 💻 JavaScript/Node.js Example

```javascript
// Inline example
async function askQuestion(question) {
  const response = await fetch('http://localhost:3000/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Answer:', data.answer);
    console.log('Confidence:', data.confidence);
  } else {
    console.error('Error:', data.error);
  }
}

// Use it
askQuestion('What is Wealth Pro II?');
```

---

## 🐍 Python Example

```python
import requests
import json

API_URL = "http://localhost:3000"

# Ask a question
response = requests.post(
    f"{API_URL}/api/ask",
    headers={"Content-Type": "application/json"},
    json={"question": "What is Wealth Pro II?"}
)

data = response.json()

if data['success']:
    print(f"Answer: {data['answer']}")
    print(f"Confidence: {data['confidence']}")
else:
    print(f"Error: {data['error']}")
```

---

## 📋 Request Parameters

### POST /api/ingest

Required:
- `filename` (string) - File name for reference
- `content` (string) - Document content (text or base64)
- `metadata` (object)
  - `productName` (string) - Insurance product name
  - `jurisdiction` (string) - Country code (e.g., "SG")
  - `versionLabel` (string) - Version (e.g., "v1.0")
  - `documentType` (string) - Type of document

Optional:
- `actorId` (string) - User ID performing ingestion (default: "api-user")

### POST /api/ask

Required:
- `question` (string) - The insurance question

Optional:
- `topK` (number) - Number of document chunks to retrieve (default: 3)
- `sessionId` (string) - Session ID for conversation tracking

---

## 🌍 Deployment Commands

### Local
```bash
npm run api
# Server runs on http://localhost:3000
```

### Docker
```bash
# Build
docker build -t policybuddies-api .

# Run
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your-key \
  policybuddies-api npm run api:prod
```

### DigitalOcean (via SSH)
```bash
ssh root@your-droplet-ip
cd PolicyBuddies
npm install
npm run api:prod
```

### Production (Detached with PM2)
```bash
npm install -g pm2
pm2 start src/web/server.js --name "api"
pm2 logs api
pm2 save
pm2 startup
```

---

## 🔧 Environment Variables

```bash
# Server
PORT=3000                    # API server port (default: 3000)
NODE_ENV=production         # Set for production

# LLM Configuration
GEMINI_API_KEY=xxx          # Google Gemini API key
OPENAI_API_KEY=xxx          # OpenAI API key (if using)

# File Paths
INGESTION_SOURCE_DIR=data/sources
INGESTION_CATALOG_PATH=data/ingestion/catalog.json
VECTOR_STORE_PATH=data/vector-store/vectors.jsonl

# Application
DEMO_SOURCE_FILE=sample.md
DEMO_PRODUCT_NAME=Sample Product
DEMO_JURISDICTION=SG
```

---

## 🐛 Error Codes & Handling

### Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Question answered |
| 400 | Bad Request | Missing required field |
| 404 | Not Found | Invalid endpoint |
| 500 | Server Error | Internal error |

### Error Response Format

```json
{
  "success": false,
  "error": "Missing required field: question"
}
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Cannot GET /api/ask" | Method not POST | Use POST method |
| "Missing required field: question" | Empty request body | Add "question" field |
| "Connection refused" | Server not running | Run `npm run api` |
| Port 3000 in use | Another app using port | Kill process on port 3000 |

---

## 📊 Performance Notes

### Default Limits
```
Max request body:      50MB
Ask timeout:           30 seconds
Max clarification:     3 turns
Max total turns:       6
Min confidence:        0.75
```

### Response Times
- Health check: ~10ms
- Catalog: ~50ms
- Single question: ~500ms–2s (depends on document size)

---

## 🔐 Security Checklist

Before production deploy:

- [ ] Environment variables configured (API keys in .env, not code)
- [ ] HTTPS/SSL enabled
- [ ] CORS restricted to your domain (not `*`)
- [ ] Rate limiting configured
- [ ] Authentication endpoint added
- [ ] Error logging configured
- [ ] Request logging configured
- [ ] Firewall whitelist rules set
- [ ] Backups enabled
- [ ] Monitoring alerts configured

---

## 📚 Documentation Files

| File | Content |
|------|---------|
| [API.md](./API.md) | Complete endpoint documentation |
| [API-QUICKSTART.md](./API-QUICKSTART.md) | 5-minute quick start |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Platform-specific deployment |
| [BUILD-SUMMARY.md](./BUILD-SUMMARY.md) | Architecture & features |
| [WEB-API-INDEX.md](./WEB-API-INDEX.md) | Comprehensive index |

---

## 🚀 Getting Started Checklist

- [ ] `npm install` - Install dependencies
- [ ] `npm run api` - Start server
- [ ] `curl http://localhost:3000/api/health` - Test health
- [ ] `node scripts/api-client.mjs` - Run full test
- [ ] Read [API-QUICKSTART.md](./API-QUICKSTART.md)
- [ ] Choose deployment platform
- [ ] Follow [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ ] Deploy and test

---

## 💡 Pro Tips

1. **Development:** Use `npm run api` with auto-reload
2. **Testing:** Keep test clients running while developing
3. **Debugging:** Check server console for detailed error logs
4. **Caching:** Add Redis for vector retrieval caching later
5. **Scaling:** Run behind load balancer for multiple instances
6. **Monitoring:** Set up DigitalOcean/AWS CloudWatch alerts

---

## 📞 Quick Reference Links

- **API Docs:** [API.md](./API.md)
- **Quick Start:** [API-QUICKSTART.md](./API-QUICKSTART.md)
- **Deployment:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Full Index:** [WEB-API-INDEX.md](./WEB-API-INDEX.md)
- **Build Summary:** [BUILD-SUMMARY.md](./BUILD-SUMMARY.md)

---

**Last Updated:** March 7, 2026  
**API Version:** 1.0.0  
**Status:** Production Ready
