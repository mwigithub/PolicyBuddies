# 🚀 Deployment Guide

Everything you need to deploy PolicyBuddies to production.

---

## 📚 Documents in This Folder

### [DEPLOYMENT.md](./DEPLOYMENT.md) ⭐ START HERE
**Complete deployment guide for 6 different platforms**

Choose your platform:
- **DigitalOcean** - $4–6/month (Recommended for POC)
- **Railway** - $5–15/month (Easiest Git integration)
- **Oracle Cloud** - FREE (Always free tier)
- **AWS** - $17–30/month (Enterprise-grade)
- **Local/SSH** - $0 (Free home/office access)
- **Docker Local** - $0 (Development/testing)

Each platform has:
- Prerequisites checklist
- Step-by-step setup instructions
- Configuration examples
- Troubleshooting tips
- Cost breakdown

**Read time:** 15-30 minutes (per platform)

### [ENV-MODES.md](./ENV-MODES.md)
**Official runbook for environment modes**

- Production: Railway + Supabase
- Local: Docker Compose + local webserver
- Required secrets/variables
- One-click deploy and verification commands

---

## 🎯 Quick Start by Platform

### Cheapest Options (Start Here)

#### 1. DigitalOcean ($4–6/month) ✨ RECOMMENDED
- [Go to setup →](./DEPLOYMENT.md#digitalocean)
- Simple droplet provisioning
- SSH access
- Good for POC
- **Setup time:** 20 minutes

#### 2. Railway ($5–15/month)
- [Go to setup →](./DEPLOYMENT.md#railway)
- Automatic Git integration
- Auto-deploy on push
- Great for development
- **Setup time:** 5 minutes

#### 3. Oracle Cloud (FREE)
- [Go to setup →](./DEPLOYMENT.md#oracle-cloud)
- Always free tier (never expires)
- Complex UI but fully featured
- Good for long-term
- **Setup time:** 30 minutes

### Cloud Options

#### 4. AWS EC2 ($17–30/month)
- [Go to setup →](./DEPLOYMENT.md#aws)
- Professional infrastructure
- Scalable
- Good for production
- **Setup time:** 30 minutes

#### 5. Local + SSH ($0)
- [Go to setup →](./DEPLOYMENT.md#localssh)
- Run on your machine
- Port forwarding setup
- Good for testing
- **Setup time:** 30 minutes

#### 6. Docker Local ($0)
- [Go to setup →](./DEPLOYMENT.md#docker-local)
- Container-based development
- Easy to scale later
- Good for development
- **Setup time:** 10 minutes

---

## 🛣️ Deployment Roadmap

### Stage 1: Development (Local)
```
Start here
  ↓
npm run api
  ↓
Test with scripts/api-client.mjs
  ↓
Ready for testing
```

### Stage 2: Proof of Concept (Pick One)
```
Choose platform:
├─ DigitalOcean (Quick & cheap)
├─ Railway (Fastest setup)
└─ Oracle Cloud (Free long-term)
  ↓
Follow platform guide
  ↓
Deploy
  ↓
Test endpoint
```

### Stage 3: Production (Scale)
```
Ready for users?
  ↓
├─ More users → Increase server size
├─ More documents → Add database
├─ Global users → Add CDN
└─ Enterprise → AWS/GCP/Azure
```

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] API runs locally: `npm run api`
- [ ] Health check works: `curl http://localhost:3000/api/health`
- [ ] Test client passes: `node scripts/api-client.mjs`
- [ ] Environment variables configured
- [ ] No console errors or warnings
- [ ] Docker image builds (if using)
- [ ] Deployment platform chosen
- [ ] Cloud account created (if needed)

---

## 💰 Cost Comparison

| Platform | Monthly Cost | Setup Time | Best For |
|----------|--------------|-----------|----------|
| **DigitalOcean** | **$4–6** | 20 min | POC, small projects |
| **Railway** | **$5–15** | 5 min | Developers, auto-deploy |
| **Oracle Cloud** | **FREE** | 30 min | Long-term, no costs |
| **AWS** | **$17–30** | 30 min | Enterprise, scaling |
| **Local SSH** | **$0** | 30 min | Testing, team demos |
| **Docker Local** | **$0** | 10 min | Development |

**Recommendation:** Start with DigitalOcean or Railway, graduate to AWS when needed.

---

## 🔄 Deployment Process (General)

### 1. Prepare Application
```bash
# Ensure API works locally
npm run api
curl http://localhost:3000/api/health
```

### 2. Choose Platform
Pick one from [DEPLOYMENT.md](./DEPLOYMENT.md)

### 3. Follow Platform Steps
Each platform has detailed setup guide

### 4. Configure Environment
Set API keys and variables

### 5. Deploy
Run deploy command for your platform

### 6. Test Production
```bash
curl https://your-domain.com/api/health
```

### 7. Monitor
Set up logging and alerts

---

## 🎯 Platform Decision Tree

```
Should it be free? → YES → Oracle Cloud
                 → NO ↓

Is setup speed critical? → YES → Railway
                        → NO ↓

Do you have AWS experience? → YES → AWS
                            → NO ↓

Choose: DigitalOcean (recommended)
```

---

## 📖 Reading Guide

1. **First:** Read this README (2 min)
2. **Then:** Find your platform below
3. **Next:** Follow step-by-step in [DEPLOYMENT.md](./DEPLOYMENT.md)
4. **Troubleshoot:** Use [DEPLOYMENT.md#troubleshooting](./DEPLOYMENT.md#troubleshooting)

---

## 🚀 Platform Guides (Quick Links)

### Getting Started Guides

| Platform | Link | Cost | Setup |
|----------|------|------|-------|
| **DigitalOcean** | [→](./DEPLOYMENT.md#digitalocean) | $4–6/mo | 20 min |
| **Railway** | [→](./DEPLOYMENT.md#railway) | $5–15/mo | 5 min |
| **Oracle Cloud** | [→](./DEPLOYMENT.md#oracle-cloud) | FREE | 30 min |
| **AWS** | [→](./DEPLOYMENT.md#aws) | $17–30/mo | 30 min |
| **Local SSH** | [→](./DEPLOYMENT.md#localssh) | $0 | 30 min |
| **Docker** | [→](./DEPLOYMENT.md#docker-local) | $0 | 10 min |

---

## ✅ Quick Access

### I want the cheapest option
→ [Oracle Cloud (FREE)](./DEPLOYMENT.md#oracle-cloud)

### I want the easiest setup
→ [Railway (5 minutes)](./DEPLOYMENT.md#railway)

### I want recommended for POC
→ [DigitalOcean ($4/month)](./DEPLOYMENT.md#digitalocean)

### I want enterprise-grade
→ [AWS ($17–30/month)](./DEPLOYMENT.md#aws)

### I want to test locally first
→ [Docker Local](./DEPLOYMENT.md#docker-local)

### I want zero setup cost
→ [Local SSH](./DEPLOYMENT.md#localssh)

---

## 🛠️ After Deployment

Once deployed, you should:

- [ ] Test health endpoint
- [ ] Ask a test question
- [ ] Ingest a test document
- [ ] Monitor server logs
- [ ] Set up backups
- [ ] Configure auto-scaling (if needed)
- [ ] Set up monitoring/alerts
- [ ] Share URL with team

---

## 📞 Troubleshooting

### Common Issues

**"What's the cheapest?"**
→ Oracle Cloud is free, DigitalOcean is $4/month

**"What's easiest?"**
→ Railway (auto Git integration)

**"What's recommended?"**
→ DigitalOcean for POC, AWS for production

**"Can I use multiple platforms?"**
→ Yes! Start on DigitalOcean, graduate to AWS

**"How do I migrate between platforms?"**
→ See [DEPLOYMENT.md#troubleshooting](./DEPLOYMENT.md#troubleshooting)

### See Detailed Troubleshooting
→ [DEPLOYMENT.md Troubleshooting](./DEPLOYMENT.md#troubleshooting)

---

## 📊 Next Steps

1. **Pick a platform** using the decision tree above
2. **Read the section** in [DEPLOYMENT.md](./DEPLOYMENT.md)
3. **Create cloud account** (if needed)
4. **Follow setup steps**
5. **Test deployment**
6. **Monitor in production**

---

## 📞 Still Need Help?

1. Check specific platform section in [DEPLOYMENT.md](./DEPLOYMENT.md)
2. See [DEPLOYMENT.md#troubleshooting](./DEPLOYMENT.md#troubleshooting)
3. Check API health: `curl https://your-url/api/health`
4. Review server logs for errors

---

**Last Updated:** March 7, 2026  
**Status:** Production Ready ✅

→ [Open DEPLOYMENT.md](./DEPLOYMENT.md) to get started
