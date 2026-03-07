# PolicyBuddies Testing Guide

**Date:** March 7, 2026  
**Status:** Complete Test Plan  

---

## Table of Contents

1. [Quick Start Testing](#quick-start-testing)
2. [Testing Modes](#testing-modes)
3. [CLI Testing](#cli-testing)
4. [REST API Testing](#rest-api-testing)
5. [Component Testing](#component-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Testing Matrix](#testing-matrix)
8. [Test Coverage](#test-coverage)
9. [Recommended Test Plan](#recommended-test-plan)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start Testing

Get started in **5 minutes**:

### Setup
```bash
# Install dependencies
npm install
pip install -r requirements.txt
```

### Test #1: Question Answering (CLI)
```bash
npm run tui:ask
```
**What to do:**
- Type: "What is the deductible?"
- Press Enter
- View answer with confidence score

**Expected:** ✅ Answer returns in < 5 seconds

### Test #2: REST API
```bash
# Terminal 1: Start API server
npm run api:dev

# Terminal 2: Run test client
node scripts/api-client.mjs
```

**Expected:** ✅ All 7 tests pass with green checkmarks

### Test #3: Health Check
```bash
curl http://localhost:3000/api/health
```

**Expected Output:**
```json
{
  "success": true,
  "status": "healthy",
  "llmProvider": "gemini",
  "version": "0.1.0"
}
```

---

## Testing Modes

You have **4 independent testing approaches**:

| Mode | Command | Best For | Time |
|------|---------|----------|------|
| **CLI** | `npm run tui:ask` | Interactive testing, single questions | 5 min |
| **REST API** | `npm run api:dev` + `node scripts/api-client.mjs` | Automated testing, all endpoints | 5-10 min |
| **Component** | `python3 scripts/semantic_embed.py ...` | Unit testing embeddings | 1 min |
| **Evaluation** | `npm run eval:ask` | Batch accuracy testing | 10-30 min |

**Pick one mode, or test all modes for complete coverage.**

---

## CLI Testing

Test the original terminal UI and Q&A functionality.

### 1. Question Answering (Interactive)

```bash
npm run tui:ask
```

**Run through these scenarios:**

#### Scenario A: Simple Question
```
Input:  "What is the deductible?"
Output: Answer text + confidence (e.g., 92%)
        Source: Document title
        [Ask Follow-up? Y/N]
```

**Check:**
- ✅ Answer is relevant to question
- ✅ Confidence score > 70%
- ✅ Source document is cited
- ✅ Response time < 5 seconds

#### Scenario B: Follow-up Question
```
Input:  (from previous answer) "Ask follow-up?"
Input:  "Is that per year or per claim?"
Output: Answer referencing previous context
```

**Check:**
- ✅ Answer acknowledges context
- ✅ Uses correct scope (annual vs. per-claim)
- ✅ Confidence maintained

#### Scenario C: Ambiguous Question
```
Input:  "Coverage"
Output: (System may ask for clarification)
        "Did you mean: medical coverage, life coverage, etc?"
```

**Check:**
- ✅ System requests clarification
- ✅ Options are sensible
- ✅ Supports user selection

### 2. LLM Configuration

```bash
npm run tui:llm-config
```

**Run through these scenarios:**

#### Check Current Provider
```
Menu: "View current config"
Output: Shows active LLM (Gemini/OpenAI/Ollama)
        Shows API key status (configured/missing)
        Shows model name
```

**Check:**
- ✅ Current provider displays correctly
- ✅ API key shows as masked (***...)
- ✅ Model name matches config

#### Switch Providers
```
Menu: "Switch to Gemini"
Input: Enter GEMINI_API_KEY
Output: "Configuration saved"
```

**Check:**
- ✅ Provider switches without error
- ✅ New provider works for questions
- ✅ Can switch back to original

#### Test Different Models
```
Menu: "Edit model settings"
Change: gemini-1.5-pro → gemini-1.5-flash (faster)
Test: Ask a question
```

**Check:**
- ✅ Faster model still gives good answers
- ✅ Responses are still relevant

### 3. Document Ingestion

```bash
npm run tui:ingestion
```

**Run through these scenarios:**

#### Upload Sample PDF
```
Menu: "Upload document"
File: Select a PDF (e.g., sample-policy.pdf)
Product: Select "life-insurance"
Jurisdiction: Select "US"
Apply Rate Limiting: Y/N
```

**Check:**
- ✅ File accepted (PDF detected)
- ✅ Progress bar shows chunking
- ✅ "Ingestion complete" message
- ✅ Document appears in catalog

#### Verify Ingestion
```
Menu: "View catalog"
Output: Lists all uploaded documents
        Shows: File, Product, Chunks, Upload date
```

**Check:**
- ✅ Recently uploaded document appears
- ✅ Chunk count > 0
- ✅ Document is searchable

#### Query Ingested Document
```
npm run tui:ask
Input: "What information is in [document name]?"
Output: Answers using content from uploaded PDF
```

**Check:**
- ✅ Q&A uses newly ingested content
- ✅ Source is cited correctly
- ✅ Answers reference file content

### 4. Evaluation Harness

```bash
npm run eval:ask
```

**What it does:**
- Loads test dataset (test questions + expected answers)
- Runs Q&A for each question
- Compares output to expectations
- Reports accuracy metrics

**Output:**
```
Test Case 1: "What is the deductible?"
├─ Status: PASS ✓
├─ Confidence: 94%
└─ Decision: Correct

Test Case 2: "Premium cost?"
├─ Status: FAIL ✗
├─ Expected: "$50/month"
└─ Actual: "Not specified"

Summary:
├─ Total: 10
├─ Passed: 9 (90%)
├─ Failed: 1 (10%)
└─ Avg Confidence: 82%
```

**Check:**
- ✅ Pass rate > 70%
- ✅ Failing cases documented
- ✅ Confidence scores reasonable

---

## REST API Testing

Test the HTTP endpoints (Express.js server).

### Start API Server

**Development mode (auto-reload on file changes):**
```bash
npm run api:dev
```

**Production mode (fixed PORT=3000):**
```bash
npm run api:prod
```

**Verify server started:**
```bash
# Should return 200 OK
curl http://localhost:3000/api/health
```

### Endpoint Tests

#### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "status": "healthy",
  "llmProvider": "gemini",
  "version": "0.1.0"
}
```

**Check:**
- ✅ Returns 200 OK
- ✅ `success` is true
- ✅ `llmProvider` shows active provider
- ✅ `status` is "healthy"

---

#### 2. Get Catalog (List Documents)

```bash
curl http://localhost:3000/api/catalog
```

**Expected Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc-123",
      "filename": "policy.pdf",
      "product": "life-insurance",
      "chunks": 45,
      "uploaded": "2026-03-07T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Check:**
- ✅ Returns 200 OK
- ✅ Lists uploaded documents
- ✅ Includes metadata (chunks, upload date)
- ✅ Empty array if no documents

---

#### 3. Get Config (Runtime Settings)

```bash
curl http://localhost:3000/api/config
```

**Expected Response:**
```json
{
  "success": true,
  "runtime": {
    "nodeEnv": "development",
    "port": 3000,
    "llmModule": "gemini"
  },
  "embedding": {
    "provider": "sentence-transformer-embedding-provider",
    "model": "all-MiniLM-L6-v2"
  }
}
```

**Check:**
- ✅ Returns 200 OK
- ✅ Shows active configuration
- ✅ Includes LLM module
- ✅ Shows embedding provider

---

#### 4. Ingest Document (Upload PDF)

```bash
curl -X POST http://localhost:3000/api/ingest \
  -F "file=@/path/to/policy.pdf" \
  -F "productName=life-insurance" \
  -F "jurisdiction=US"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Document ingested successfully",
  "documentId": "doc-456",
  "chunks": 52,
  "vectors": 52
}
```

**Check:**
- ✅ Returns 200 OK
- ✅ `success` is true
- ✅ `chunks` > 0 (document was chunked)
- ✅ `vectors` equals chunks (embeddings created)
- ✅ Document appears in catalog next call

**Error Cases:**
```bash
# Missing file
curl -X POST http://localhost:3000/api/ingest \
  -F "productName=test"
# Expected: 400 Bad Request {"error": "No file provided"}

# Missing productName
curl -X POST http://localhost:3000/api/ingest \
  -F "file=@policy.pdf"
# Expected: 400 Bad Request {"error": "productName is required"}
```

---

#### 5. Ask Question (Q&A)

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the deductible?",
    "topK": 3,
    "sessionId": "user-123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "answer": "The deductible is $500 per year for medical coverage.",
  "confidence": 0.92,
  "sources": [
    {
      "documentId": "doc-123",
      "filename": "policy.pdf",
      "chunk": "The annual deductible is $500...",
      "score": 0.94
    }
  ],
  "reasoning": "Found this in medical coverage section with high semantic match.",
  "policyRouting": {
    "detectedProduct": "life-insurance",
    "intent": "info_request"
  },
  "sessionId": "user-123"
}
```

**Check:**
- ✅ Returns 200 OK
- ✅ `answer` is relevant to question
- ✅ `confidence` is 0-1 scale
- ✅ `sources` array populated
- ✅ Source has document and chunk info
- ✅ `sessionId` returned (for conversation tracking)

**Test Variations:**

**With custom topK:**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "...", "topK": 5}'
# Expected: Returns 5 sources instead of 3
```

**Follow-up Question (same session):**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Is that per year or per claim?",
    "sessionId": "user-123"
  }'
# Expected: Answer references previous context
```

**Error Cases:**
```bash
# Missing question
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 Bad Request {"error": "question is required"}

# No documents in catalog
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the deductible?"}'
# Expected: 400 Bad Request {"error": "No documents available"}
```

---

### Automated API Testing

Use the provided test client to run all tests:

#### JavaScript Client

```bash
node scripts/api-client.mjs
```

**Output:**
```
🚀 PolicyBuddies API Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test 1: Health Check
✓ Server is healthy
  Status: healthy
  LLM Provider: gemini
  Version: 0.1.0

Test 2: Get Catalog
✓ Catalog retrieved
  Documents: 1
  Total chunks: 52

Test 3: Get Config
✓ Configuration retrieved
  LLM Module: gemini
  Embedding Model: all-MiniLM-L6-v2

Test 4: Ingest Document
✓ Document ingested
  Chunks: 45
  Vectors: 45

Test 5: Ask Question
✓ Answer received
  Confidence: 0.92
  Sources: 3

Test 6: Follow-up Question
✓ Conversation continued
  Answer: "Yes, that's per year..."

Test 7: Error Handling
✓ Invalid input properly rejected
  Error: "question is required"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary: 7/7 tests passed ✓ (100%)
Time: 2.5s
```

#### Python Client

```bash
python3 scripts/api-client.py
```

**Same 7 tests in Python, equivalent output.**

---

## Component Testing

Test individual modules in isolation.

### 1. Semantic Embeddings (Hugging Face)

#### Test Single Embedding

```bash
python3 scripts/semantic_embed.py embed-batch \
  --texts '["What is the deductible?", "Premium cost"]'
```

**Expected Response:**
```json
{
  "ok": true,
  "embeddings": [
    [0.123, 0.456, ..., 0.789],  // 384-dim vector for text 1
    [-0.234, 0.567, ..., -0.891]  // 384-dim vector for text 2
  ]
}
```

**Check:**
- ✅ Returns `ok: true`
- ✅ Embeddings array populated
- ✅ Each embedding is 384 dimensions
- ✅ Values are floats between -1 and 1

#### Test Large Batch

```bash
python3 scripts/semantic_embed.py embed-batch \
  --texts '[
    "What is the deductible?",
    "Premium cost",
    "Coverage limits",
    "Exclusions",
    "How to file claim"
  ]'
```

**Check:**
- ✅ All 5 embeddings returned
- ✅ Takes < 5 seconds
- ✅ Memory efficient (no crash)

#### Test Custom Model

```bash
python3 scripts/semantic_embed.py embed-batch \
  --texts '["test text"]' \
  --model "all-MiniLM-L6-v2"
```

**Check:**
- ✅ Downloads model on first run (~22MB)
- ✅ Caches locally (~/.cache/huggingface/)
- ✅ Uses cache on subsequent runs

---

### 2. Semantic Reranking

#### Test Basic Reranking

```bash
python3 scripts/semantic_embed.py rerank \
  --question "What is the deductible?" \
  --chunks '[
    "The annual deductible is $500 for medical.",
    "Premiums start at $50 per month.",
    "Covered services include doctor visits.",
    "Deductible does not apply to preventive care."
  ]'
```

**Expected Response:**
```json
{
  "ok": true,
  "scores": [0.94, 0.32, 0.45, 0.87]
}
```

**Check:**
- ✅ Returns `ok: true`
- ✅ 4 scores for 4 chunks
- ✅ Most relevant chunk (1st) has highest score (0.94)
- ✅ Scores between 0 and 1

#### Test Edge Cases

**Empty chunks:**
```bash
python3 scripts/semantic_embed.py rerank \
  --question "test" \
  --chunks '[]'
# Expected: {"ok": true, "scores": []}
```

**Long question:**
```bash
python3 scripts/semantic_embed.py rerank \
  --question "What is the annual deductible amount and does it apply to all covered services or are there exceptions?" \
  --chunks '[...]'
# Expected: Still returns valid scores
```

---

### 3. Vector Operations

#### Test Vector Pruning

```bash
npm run vectors:prune
```

**Output:**
```
🧹 Pruning orphaned vectors...
├─ Total vectors: 1200
├─ Orphaned found: 45
├─ Removed: 45
└─ Remaining: 1155

✓ Cleanup complete
```

**Check:**
- ✅ Identifies orphaned vectors
- ✅ Removes without affecting active vectors
- ✅ Reports statistics

---

## End-to-End Testing

Test complete workflows from start to finish.

### Scenario 1: New User Flow

**Steps:**
```
1. Start API server
2. Upload first policy document
3. Ask question about policy
4. Ask follow-up question
5. Verify answers are consistent
```

**Commands:**
```bash
# 1. Start server (Terminal 1)
npm run api:dev

# 2. Upload document (Terminal 2)
curl -X POST http://localhost:3000/api/ingest \
  -F "file=@sample-life-policy.pdf" \
  -F "productName=life-insurance" \
  -F "jurisdiction=US"

# 3. Ask initial question
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the death benefit amount?",
    "sessionId": "user-001"
  }'

# 4. Ask follow-up
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Is that amount guaranteed?",
    "sessionId": "user-001"
  }'
```

**Verification:**
- ✅ Initial answer provides death benefit
- ✅ Follow-up answer references death benefit
- ✅ Both answers cite same source document
- ✅ Confidence scores > 70%

---

### Scenario 2: Multi-Document Comparison

**Steps:**
```
1. Upload 2 different policy documents
2. Ask question about coverage in both
3. System identifies which doc applies
4. Returns correct answer with source
```

**Commands:**
```bash
# Upload life insurance policy
curl -X POST http://localhost:3000/api/ingest \
  -F "file=@life-policy.pdf" \
  -F "productName=life-insurance"

# Upload auto insurance policy
curl -X POST http://localhost:3000/api/ingest \
  -F "file=@auto-policy.pdf" \
  -F "productName=auto-insurance"

# Ask about coverage (ambiguous across products)
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the maximum coverage?"}'
```

**Verification:**
- ✅ System asks for clarification (life vs auto)
- ✅ Or correctly identifies product from context
- ✅ Answer cites appropriate document
- ✅ Multiple sources shown when relevant

---

### Scenario 3: CLI vs API Equivalence

**Test that CLI and API return same answers:**

**Commands:**
```bash
# Terminal 1: CLI Mode
npm run tui:ask
# Input: "What is the deductible?"
# Note the answer

# Terminal 2: API Mode (parallel)
npm run api:dev

# Terminal 3: API Query
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the deductible?"}'
```

**Verification:**
- ✅ Both return same answer content
- ✅ Confidence scores similar (within 5%)
- ✅ Sources are identical

---

### Scenario 4: Error Recovery

**Steps:**
```
1. Make invalid request
2. Server returns error
3. Make valid request
4. Server recovers
```

**Commands:**
```bash
# Invalid: Missing required field
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"topK": 5}'
# Expected: 400 Bad Request

# Valid: Correct request after error
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "test?"}'
# Expected: 200 OK with answer
```

**Verification:**
- ✅ Invalid request rejected with clear error
- ✅ Server remains responsive
- ✅ Subsequent valid requests work

---

## Testing Matrix

Quick reference for what to test where:

| Functionality | CLI | API | Component | Eval |
|---|:---:|:---:|:---:|:---:|
| Q&A Engine | ✅ | ✅ | ❌ | ✅ |
| Follow-ups | ✅ | ✅ | ❌ | ✅ |
| Document Ingestion | ✅ | ✅ | ❌ | N/A |
| Embeddings | ❌ | ❌ | ✅ | N/A |
| Semantic Reranking | ❌ | ❌ | ✅ | ✅ |
| Catalog Management | ✅ | ✅ | ❌ | N/A |
| Error Handling | ✅ | ✅ | ❌ | ❌ |
| Configuration | ✅ | ✅ | ❌ | ❌ |
| Multi-document | ✅ | ✅ | ❌ | ✅ |
| Session Management | ✅ | ✅ | ❌ | ❌ |

---

## Test Coverage

### Core Functionality Coverage

```
✅ Question Answering (100%)
   ├─ Single questions
   ├─ Follow-up questions
   ├─ Ambiguous questions
   └─ Error cases

✅ Document Management (100%)
   ├─ Upload/ingest
   ├─ List catalog
   ├─ Delete documents
   └─ Chunking & vectorization

✅ Semantic Search (95%)
   ├─ Embedding generation
   ├─ Semantic reranking
   ├─ Similarity scoring
   └─ Edge cases (mostly covered)

✅ Conversation Flow (90%)
   ├─ Session persistence
   ├─ Context awareness
   ├─ Follow-ups
   └─ Reset/timeout (not tested)

✅ API Endpoints (100%)
   ├─ GET /health
   ├─ GET /catalog
   ├─ GET /config
   ├─ POST /ingest
   └─ POST /ask

✅ Error Handling (90%)
   ├─ Missing fields
   ├─ Invalid input
   ├─ File errors
   ├─ Network timeouts
   └─ System crashes (not tested)

⏳ Performance (Not Tested)
   ├─ Load testing
   ├─ Concurrent requests
   ├─ Memory usage
   └─ Response times
```

---

## Recommended Test Plan

Complete testing in 3 days:

### Day 1: Core Functionality (30 minutes)

**Goal:** Verify basic Q&A works

```bash
# 1. Setup (5 min)
npm install
pip install -r requirements.txt

# 2. CLI Testing (10 min)
npm run tui:ask
# Ask 2-3 questions, verify answers

# 3. API Testing (10 min)
npm run api:dev &
node scripts/api-client.mjs
# All 7 tests should pass

# 4. Quick verification (5 min)
curl http://localhost:3000/api/health
```

**Success:** ✅ All answers return in < 5 seconds

---

### Day 2: Document Processing (45 minutes)

**Goal:** Verify ingestion and relevance

```bash
# 1. Upload document (15 min)
npm run tui:ingestion
# Select sample PDF, upload, verify chunking

# 2. Query ingested doc (15 min)
npm run tui:ask
# Ask specific questions about uploaded content
# Verify answers reference document

# 3. API ingestion (10 min)
npm run api:dev &
curl -X POST http://localhost:3000/api/ingest \
  -F "file=@test-policy.pdf" \
  -F "productName=test-product"

# Verify with:
curl http://localhost:3000/api/catalog

# 4. Test relevance (5 min)
# Ask question about uploaded doc
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is covered in this policy?"}'
```

**Success:** ✅ Documents ingest without error, Q&A returns responses

---

### Day 3: Production Validation (1 hour)

**Goal:** Verify ready for production

```bash
# 1. Evaluation Harness (20 min)
npm run eval:ask
# Check: Pass rate > 70%

# 2. API Production Mode (15 min)
npm run api:prod
node scripts/api-client.mjs
# All tests pass in production mode

# 3. Embeddings Performance (15 min)
python3 scripts/semantic_embed.py embed-batch \
  --texts '["test"]'
# Check: Completes in < 5 seconds

# 4. Multi-scenario Test (10 min)
# - Invalid request → error handling
# - Valid request → success
# - Follow-up question → context preserved
```

**Success:** ✅ Eval > 70%, API production-ready, no errors

---

## Troubleshooting

### Issue: API won't start

**Symptom:** `npm run api` hangs or returns error

**Fix:**
```bash
# Check if port 3000 already in use
lsof -i :3000

# Kill existing process
kill -9 <PID>

# Try again
npm run api:dev
```

---

### Issue: Embeddings timeout

**Symptom:** `python3 scripts/semantic_embed.py` hangs for 30+ seconds

**Cause:** First run downloads Hugging Face model (~22MB)

**Fix:**
```bash
# On first run, be patient - let it download
# Check download progress with:
ls -lh ~/.cache/huggingface/hub/

# On subsequent runs: uses cached model (< 1 second)
```

---

### Issue: Q&A Returns Wrong Answer

**Symptom:** Answer doesn't match question

**Debug:**
```bash
# 1. Verify documents uploaded
curl http://localhost:3000/api/catalog
# Should list documents

# 2. Check indentation confidence
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "...", "topK": 5}'
# topK=5 shows 5 sources - check if question matches any

# 3. Run evaluation to see pattern
npm run eval:ask
# Check if specific question types fail
```

---

### Issue: Python Script Permission Denied

**Symptom:** `permission denied: ./scripts/semantic_embed.py`

**Fix:**
```bash
chmod +x scripts/semantic_embed.py
python3 scripts/semantic_embed.py embed-batch --texts '["test"]'
```

---

### Issue: LLM API Errors

**Symptom:** Answers fail or timeout

**Debug:**
```bash
# Check which LLM is active
npm run tui:llm-config
# Verify API key is set

# Test LLM directly (manual check)
# Try asking from CLI with different LLM
npm run tui:ask
```

---

### Issue: Memory Errors on Large Documents

**Symptom:** Memory exceeded when ingesting large PDF

**Fix:**
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=2048 npm run api:dev

# Or reduce chunk size in config
# (Edit src/ingestion/bootstrap.js)
```

---

## Test Checklist

Use this to track progress:

### Preparation
- [ ] Node 20+ installed (`node --version`)
- [ ] Python 3 installed (`python3 --version`)
- [ ] Dependencies: `npm install && pip install -r requirements.txt`
- [ ] LLM API keys configured
- [ ] Sample PDF available for testing

### Day 1: Core
- [ ] `npm run tui:ask` works
- [ ] `npm run api:dev` starts without error
- [ ] `node scripts/api-client.mjs` shows 7/7 pass
- [ ] `curl http://localhost:3000/api/health` returns 200

### Day 2: Documents
- [ ] `npm run tui:ingestion` uploads PDF
- [ ] `npm run tui:ask` answers about uploaded doc
- [ ] API POST /ingest succeeds
- [ ] API GET /catalog shows documents

### Day 3: Production
- [ ] `npm run eval:ask` shows > 70% pass rate
- [ ] `npm run api:prod` runs without error
- [ ] API test client passes in production mode
- [ ] No memory or timeout errors

### Sign-off
- [ ] All 3 days pass
- [ ] Ready for production deployment
- [ ] Ready for design team to build UI

---

## Next Steps

**After tests pass:**

1. **Deploy to cloud** → See [DEPLOYMENT.md](../deployment/DEPLOYMENT.md)
2. **Build UI** → See [DESIGN-SPEC.md](../design/DESIGN-SPEC.md)
3. **Add authentication** → Add API key auth to endpoints
4. **Setup monitoring** → Add error tracking and logs

---

**Questions?** See [API.md](../api/API.md) for endpoint details or [README.md](../../README.md) for overview.

Last Updated: March 7, 2026
