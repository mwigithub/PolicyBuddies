# 🔌 API Documentation

Everything you need to integrate with the PolicyBuddies API.

---

## 📚 Documents in This Folder

### 1. [QUICKSTART.md](./QUICKSTART.md) ⭐ START HERE
**5-minute quick start to get the API running**
- Start the API server
- Test health endpoint
- Run full test suite
- Basic integration example
- Troubleshooting tips

**Read time:** 5 minutes

### 2. [REFERENCE.md](./REFERENCE.md)
**Developer reference card with quick access**
- Quick commands
- All endpoint examples
- Request/response examples
- cURL, JavaScript, and Python examples
- Environment variables
- Performance notes

**Read time:** 10 minutes

### 3. [API.md](./API.md)
**Complete API specification**
- Full endpoint documentation
- Request/response schemas
- Error handling
- Rate limiting
- Integration examples
- Deployment notes

**Read time:** 20 minutes

---

## 🎯 Quick Navigation by Task

### I want to test the API (5 minutes)
1. Read: [QUICKSTART.md](./QUICKSTART.md)
2. Run: `npm run api`
3. Test: `curl http://localhost:3000/api/health`

### I need endpoint details (10 minutes)
1. Read: [REFERENCE.md](./REFERENCE.md)
2. Copy example code
3. Integrate into your app

### I want complete reference (20 minutes)
1. Read: [API.md](./API.md)
2. Save for reference
3. Build your integration

### I need to integrate with my frontend (30 minutes)
1. Start with: [REFERENCE.md](./REFERENCE.md) (copy examples)
2. Reference: [API.md](./API.md) (endpoint specs)
3. See: [QUICKSTART.md](./QUICKSTART.md) (troubleshooting)

---

## 🔑 API Overview

### 5 Main Endpoints

```
GET  /api/health         Check if API is running
GET  /api/catalog        List indexed documents
GET  /api/config         View runtime configuration
POST /api/ingest         Upload & ingest a document
POST /api/ask            Ask an insurance question
```

### Example Request

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is covered?"}'
```

### Example Response

```json
{
  "success": true,
  "question": "What is covered?",
  "answer": "Wealth Pro II covers...",
  "confidence": 0.87,
  "sources": [...]
}
```

---

## ⚡ Ready to Start?

### Option 1: Quick Start (Recommended)
→ **[Open QUICKSTART.md](./QUICKSTART.md)** (5 min)

### Option 2: Copy Code Examples
→ **[Open REFERENCE.md](./REFERENCE.md)** (10 min)

### Option 3: Full Specification
→ **[Open API.md](./API.md)** (20 min)

---

## 📂 What's Where

| File | Contents | Audience |
|------|----------|----------|
| QUICKSTART.md | Get running in 5 minutes | Everyone starting out |
| REFERENCE.md | Looking up endpoints | Active developers |
| API.md | Complete specification | Integration developers |

---

## 🚀 Server Commands

### Start API

```bash
npm run api              # Development (auto-reload)
npm run api:prod        # Production mode
```

### Test with Clients

```bash
node scripts/api-client.mjs    # JavaScript test suite
python3 scripts/api-client.py  # Python test suite
```

### Original CLI (Still Works)

```bash
npm run tui:ask         # Terminal ask UI
npm run tui:ingestion   # Terminal ingestion UI
```

---

## 🛠️ Setup Check

- [ ] API running: `npm run api`
- [ ] Health check: `curl http://localhost:3000/api/health`
- [ ] Test client: `node scripts/api-client.mjs`
- [ ] Picked starting document above

---

## 💡 Pro Tips

1. **Keep [REFERENCE.md](./REFERENCE.md) open** while coding - it's a quick lookup
2. **Test with curl first** before integrating with code
3. **Use [QUICKSTART.md](./QUICKSTART.md)** to troubleshoot
4. **See [API.md](./API.md)** for error handling details

---

## 🔍 Find Something Specific

### I want to...

| Task | Go To |
|------|-------|
| Get API running fast | [QUICKSTART.md](./QUICKSTART.md) |
| See all endpoints | [REFERENCE.md](./REFERENCE.md) |
| Learn error handling | [API.md](./API.md) |
| Find JavaScript examples | [REFERENCE.md](./REFERENCE.md#-javascriptnode-example) |
| Find Python examples | [REFERENCE.md](./REFERENCE.md#-python-example) |
| See curl examples | [REFERENCE.md](./REFERENCE.md#-api-endpoints) |
| Check environment vars | [REFERENCE.md](./REFERENCE.md#-environment-variables) |
| Troubleshoot errors | [QUICKSTART.md](./QUICKSTART.md#troubleshooting) |

---

## 📖 Reading Order (Recommended)

1. **Start here:** [QUICKSTART.md](./QUICKSTART.md) (5 min)
   - Get the server running
   - Verify it works
   
2. **Copy examples:** [REFERENCE.md](./REFERENCE.md) (10 min)
   - Pick your language
   - Copy code samples
   
3. **Deep dive (optional):** [API.md](./API.md) (20 min)
   - Full specifications
   - All error codes
   - Advanced usage

---

## 🎯 Success Criteria

You'll know you're good when:
- ✅ API server runs without errors
- ✅ Health check returns `{"status": "ok"}`
- ✅ Test client completes all tests successfully
- ✅ You can ask questions and get answers
- ✅ You understand the 5 main endpoints

---

## 📞 Stuck?

1. Check [QUICKSTART.md Troubleshooting](./QUICKSTART.md#troubleshooting)
2. Check [API.md Error Handling](./API.md#error-handling)
3. Run `npm run api` to see detailed logs
4. Test with curl first: `curl http://localhost:3000/api/health`

---

**Last Updated:** March 7, 2026  
**Status:** Production Ready ✅

Ready? → [Open QUICKSTART.md](./QUICKSTART.md)
