# PolicyBuddies Web API - Quick Start Guide

## What We Just Built

You now have a **fully functional REST API** for PolicyBuddies! 🎉

The old CLI (`npm run tui:ask`) is now accessible via HTTP requests, perfect for:
- Integrating with web apps
- Building mobile apps
- Enabling remote access
- Scaling to production

---

## File Structure

```
PolicyBuddies/
├── src/web/
│   └── server.js                    ← New API server
├── scripts/
│   ├── api-client.mjs               ← JavaScript test client
│   └── api-client.py                ← Python test client
├── API.md                           ← Full API documentation
├── DEPLOYMENT.md                    ← Deployment guide
├── Dockerfile                       ← Docker image config
├── .dockerignore                    ← Docker exclude file
└── package.json                     ← Updated with Express.js
```

---

## Quick Start (5 minutes)

### 1. Start the API Server

```bash
npm run api
```

You should see:
```
✓ PolicyBuddies Web API Server running
  Port: 3000
  Environment: development
  API Endpoints:
    GET  /api/health
    GET  /api/catalog
    GET  /api/config
    POST /api/ingest
    POST /api/ask
```

### 2. Test Health Endpoint

In another terminal:
```bash
curl http://localhost:3000/api/health
```

Should return:
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

### 3. Test Full Flow

#### Option A: Use JavaScript Client
```bash
node scripts/api-client.mjs
```

#### Option B: Use Python Client
```bash
python3 scripts/api-client.py
```

#### Option C: Manual cURL
```bash
# 1. Ingest a document
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "sample-policy.md",
    "content": "Sample insurance policy content here...",
    "metadata": {
      "productName": "Sample Product",
      "jurisdiction": "SG",
      "versionLabel": "v1",
      "documentType": "product summary"
    }
  }'

# 2. Ask a question
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the coverage options?"
  }'
```

---

## Available Commands

### Development
```bash
npm run api           # Start with hot reload (development)
npm run api:dev       # Same as above
npm run api:prod      # Start in production mode
```

### Testing Clients
```bash
node scripts/api-client.mjs    # Run JavaScript test suite
python3 scripts/api-client.py  # Run Python test suite
```

### Original CLI (Still Works)
```bash
npm start              # Original main entry point
npm run tui:ask        # Original interactive terminal UI
npm run tui:ingestion  # Ingestion terminal UI
npm run tui:llm-config # LLM config terminal UI
```

---

## API Endpoints at a Glance

| method | Endpoint | Purpose |
|--------|----------|---------|
| GET    | /api/health | Check if server is running |
| GET    | /api/catalog | List indexed documents |
| GET    | /api/config | View runtime configuration |
| POST   | /api/ingest | Upload & ingest a document |
| POST   | /api/ask | Ask an insurance question |

**Full documentation:** See [API.md](./API.md)

---

## Deployment

Choose your deployment platform:

### Cheapest Options
1. **DigitalOcean** - $4/month basic droplet
2. **Railway** - $5–15/month (easiest Git integration)
3. **Oracle Cloud** - Free forever (always free tier)
4. **Local + SSH** - Free (requires port forwarding setup)

### Cloud Options
5. **AWS** - $17–30/month EC2
6. **Google Cloud** - Similar to AWS
7. **Render** - Free tier available

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step setup for each platform**

---

## Example: Building a Web App Frontend

Now that you have an API, you can build a frontend:

### React Example
```javascript
// In your React component
const [answer, setAnswer] = useState("");
const [loading, setLoading] = useState(false);

const askQuestion = async (question) => {
  setLoading(true);
  try {
    const response = await fetch("http://localhost:3000/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, topK: 3 })
    });
    const data = await response.json();
    setAnswer(data.answer);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    setLoading(false);
  }
};

return (
  <div>
    <input 
      onSubmit={() => askQuestion(input)} 
      placeholder="Ask your insurance question..."
    />
    {loading && <p>Loading...</p>}
    {answer && <p>{answer}</p>}
  </div>
);
```

### HTML/Vanilla JS Example
```html
<!DOCTYPE html>
<html>
<body>
  <input id="question" placeholder="Ask a question...">
  <button onclick="ask()">Ask</button>
  <div id="answer"></div>

  <script>
    async function ask() {
      const question = document.getElementById("question").value;
      const response = await fetch("http://localhost:3000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await response.json();
      document.getElementById("answer").textContent = data.answer;
    }
  </script>
</body>
</html>
```

---

## Production Considerations

Before deploying to production, ensure:

- [ ] Environment variables are configured (API keys, secrets)
- [ ] SSL/TLS certificate installed (HTTPS)
- [ ] Rate limiting enabled
- [ ] Request logging configured
- [ ] Error monitoring set up
- [ ] Backup strategy in place
- [ ] Database or persistent storage configured
- [ ] CORS headers configured for your domain

See [DEPLOYMENT.md](./DEPLOYMENT.md#production-checklist) for full checklist.

---

## Troubleshooting

### "Port 3000 already in use"
```bash
# Find what's using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

### "Cannot find module 'express'"
```bash
# Make sure dependencies are installed
npm install
```

### "API returns 500 errors"
```bash
# Check logs for errors
# The server will print stack traces to console
npm run api
```

### "CORS errors in browser"
The API server has CORS enabled by default. If you still get errors:
- Make sure the API server is running
- Check the browser console for the actual error
- Verify you're using the correct API URL

---

## Next Steps

1. **Test locally** with the provided client scripts
2. **Build your frontend** (React, Vue, Angular, etc.)
3. **Deploy backend** to your chosen platform
4. **Deploy frontend** separately
5. **Monitor and scale** as needed

---

## Useful Resources

- **API Documentation:** [API.md](./API.md)
- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Original README:** [README.md](./README.md)
- **Architecture Docs:** [docs/architecture/](./docs/architecture/)

---

## Support

- Check the API response for detailed error messages
- Run the test clients to verify connectivity
- See logs in the server terminal for debugging
- Review [API.md](./API.md) for expected request/response formats

---

## What's Next?

### Option 1: Deploy Immediately
→ Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for your chosen platform

### Option 2: Build a Web Frontend
→ Use your favorite framework (React, Vue, Angular, etc.) with examples above

### Option 3: Customize the API
→ Edit [src/web/server.js](./src/web/server.js) to add features

### Option 4: Add Authentication
→ Implement API keys, JWT, or OAuth in the Express.js app

---

**Happy deploying! 🚀**

Questions? Check [API.md](./API.md) or [DEPLOYMENT.md](./DEPLOYMENT.md)
