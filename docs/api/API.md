# PolicyBuddies Web API Documentation

## Overview

PolicyBuddies now includes a **REST API** for programmatic access to insurance Q&A, document ingestion, and configuration management.

**Base URL:** `http://localhost:3000` (local) or your deployed server URL

---

## Quick Start

### 1. Start the API Server

```bash
npm run api        # Development mode (with hot reload)
npm run api:prod   # Production mode
```

Server logs will show:
```
✓ PolicyBuddies Web API Server running
  Port: 3000
  API Endpoints:
    GET  /api/health
    GET  /api/catalog
    GET  /api/config
    POST /api/ingest
    POST /api/ask
```

### 2. Test the API

```bash
curl http://localhost:3000/api/health
```

---

## API Endpoints

### 1. Health Check

**Endpoint:** `GET /api/health`

**Purpose:** Verify API is running and check system status

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-07T10:30:45.123Z",
  "version": "1.0.0",
  "environment": {
    "llmProvider": "gemini",
    "pipeline": "mvp-ingestion-v1"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/health
```

---

### 2. Get Catalog (List Indexed Documents)

**Endpoint:** `GET /api/catalog`

**Purpose:** List all indexed insurance documents

**Response:**
```json
{
  "success": true,
  "documentCount": 2,
  "documents": [
    {
      "id": "doc_v1_abc123",
      "sourcePath": "tokio-marine-life-wealth-pro.pdf",
      "productName": "Wealth Pro II",
      "jurisdiction": "SG",
      "versionLabel": "v1.0",
      "documentType": "product summary",
      "indexedAt": "2026-03-07T10:15:00Z"
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/catalog
```

---

### 3. Get Configuration

**Endpoint:** `GET /api/config`

**Purpose:** Retrieve runtime configuration and settings

**Response:**
```json
{
  "success": true,
  "config": {
    "pipelineVersion": "mvp-ingestion-v1",
    "planner": {
      "enabled": true,
      "strictRouting": false,
      "llmFirst": true,
      "minPlannerConfidence": 0.6
    },
    "agenticOrchestration": {
      "enabled": true,
      "maxClarificationTurns": 3,
      "maxTotalTurns": 6,
      "maxQuestionsPerTurn": 1,
      "minConfidenceToFinalize": 0.75,
      "overallTimeoutMs": 30000
    },
    "vectorStorePath": "data/vector-store/vectors.jsonl",
    "ingestionSourceDir": "data/sources"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/config
```

---

### 4. Ingest Document

**Endpoint:** `POST /api/ingest`

**Purpose:** Upload and ingest a new insurance policy document

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "filename": "tokio-marine-wealth-pro-ii.pdf",
  "content": "...(base64 encoded PDF or raw text)...",
  "metadata": {
    "productName": "Wealth Pro II",
    "jurisdiction": "SG",
    "versionLabel": "v1.0",
    "documentType": "product summary"
  },
  "actorId": "api-user"
}
```

**Response:**
```json
{
  "success": true,
  "runId": "run_1234567890abc",
  "documentVersionId": "doc_v1_abc123",
  "chunksGenerated": 42,
  "vectorsStored": 42
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "sample-policy.pdf",
    "content": "Policy document text here...",
    "metadata": {
      "productName": "Sample Product",
      "jurisdiction": "SG",
      "versionLabel": "v1",
      "documentType": "product summary"
    }
  }'
```

---

### 5. Ask Question (Main Q&A Endpoint)

**Endpoint:** `POST /api/ask`

**Purpose:** Ask an insurance-related question and get an answer with reasoning

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "question": "What is the investment option in Wealth Pro II?",
  "topK": 3,
  "sessionId": "session_abc123"
}
```

**Parameters:**
- `question` (required): The insurance question to answer
- `topK` (optional, default: 3): Number of top document chunks to retrieve
- `sessionId` (optional): Session ID for conversation tracking

**Response:**
```json
{
  "success": true,
  "question": "What is the investment option in Wealth Pro II?",
  "answer": "Wealth Pro II offers multiple investment options including balanced, growth, and conservative portfolios...",
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

**Example:**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the investment option in Wealth Pro II?",
    "topK": 3
  }'
```

---

## Error Handling

All endpoints return structured error responses:

### Error Response Format
```json
{
  "success": false,
  "error": "Missing required field: question"
}
```

### Common Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (missing or invalid fields) |
| 404 | Endpoint not found |
| 500 | Server error |

### Example Error:
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```json
{
  "success": false,
  "error": "Missing required field: question"
}
```

---

## Client Examples

See examples in:
- JavaScript/Node.js: `scripts/api-client.mjs`
- Python: `scripts/api-client.py`
- cURL: See examples above

---

## Environment Variables

Configure the server with these variables:

```bash
# Server Port
PORT=3000

# Node Environment
NODE_ENV=development  # or production

# LLM Configuration
GEMINI_API_KEY=your-key
OPENAI_API_KEY=your-key

# File Paths
INGESTION_SOURCE_DIR=data/sources
DEMO_SOURCE_FILE=sample-policy.md
```

---

## Performance & Limits

| Aspect | Limit |
|--------|-------|
| Max Request Body | 50MB |
| Max Document Size | 50MB |
| Ask Timeout | 30 seconds |
| Max Clarification Turns | 3 |
| Max Total Turns | 6 |

---

## Rate Limiting

Currently: **No rate limiting** (add based on your needs)

Recommendation for production:
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Deployment

### Docker
```bash
docker build -t policybuddies-api .
docker run -p 3000:3000 policybuddies-api npm run api:prod
```

### DigitalOcean / Fly.io / Render
See `DEPLOYMENT.md` for platform-specific instructions.

---

## Troubleshooting

### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
→ Make sure server is running: `npm run api`

### Timeout Errors
```
Error: Ask timeout: 30000ms exceeded
```
→ Increase `overallTimeoutMs` in `config/runtime.json`

### No Documents Found
```
"documentCount": 0
```
→ Ingest documents first using `POST /api/ingest`

---

## Next Steps

1. **Testing**: Use the example clients in `scripts/`
2. **Integration**: Connect your web app to the API
3. **Monitoring**: Set up logs and metrics 
4. **Security**: Add authentication (API keys, JWT, etc.)
5. **Scaling**: Deploy to cloud platform (DigitalOcean, AWS, etc.)
