# PolicyBuddies Web API - Deployment Guide

## Deployment Options

Choose the platform that best fits your needs:

1. **[Local/SSH](#local-ssh)** - Your own computer (cheapest, requires SSH setup)
2. **[DigitalOcean](#digitalocean)** - $4–6/month, simple deployment
3. **[Railway](#railway)** - $5–15/month, easiest Git integration
4. **[Oracle Cloud](#oracle-cloud)** - Free forever (always free tier)
5. **[AWS](#aws)** - $17–30/month, enterprise-grade
6. **[Docker](#docker-local)** - Local containerized setup

---

## Local/SSH

### Prerequisites
- macOS/Linux computer with static IP or dynamic DNS
- Router that supports port forwarding
- SSH server enabled on local machine

### Setup

1. **Enable SSH on your machine:**
   ```bash
   # macOS
   sudo systemsetup -setremotelogin on
   
   # Linux
   sudo systemctl start ssh
   sudo systemctl enable ssh
   ```

2. **Set up port forwarding:**
   - Log into your router (192.168.1.1)
   - Port Forward: External 2222 → Internal IP:22
   - Note: Many ISPs block port 22, use 2222 instead

3. **Disable SSH password login (security):**
   ```bash
   # Generate SSH key on client machine
   ssh-keygen -t ed25519
   
   # Copy public key to server
   ssh-copy-id -i ~/.ssh/id_ed25519.pub username@your-server-ip
   ```

4. **Start the API server:**
   ```bash
   ssh -p 2222 username@your-public-ip
   cd /path/to/PolicyBuddies
   npm run api:prod
   ```

5. **Use dynamic DNS (if IP changes):**
   ```bash
   # Install ddclient
   brew install ddclient  # macOS
   
   # Or use free service: duckdns.org, no-ip.com
   ```

### Access from Remote Machine
```bash
ssh -i ~/.ssh/id_ed25519 -p 2222 username@yourdomain.duckdns.org
npm run api:prod
```

### Pros & Cons
✅ **Pros:** No costs, full control  
❌ **Cons:** Requires manual setup, ISP may block ports, home internet outages affect availability

---

## DigitalOcean

### Prerequisites
- DigitalOcean account (gets $200 free credit)
- SSH keys set up (DigitalOcean can generate them)

### Step 1: Create Droplet
```bash
# Via CLI (if installed)
doctl compute droplet create policybuddies \
  --size s-1vcpu-1gb \
  --image ubuntu-22-04-x64 \
  --region sfo3 \
  --ssh-keys your-ssh-key-id \
  --enable-backups

# Or via web dashboard:
# - Choose: Ubuntu 22.04
# - Size: Basic ($4/month)
# - Region: Choose closest to you
# - SSH Key: Add your public key
```

### Step 2: SSH into Droplet
```bash
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs npm

# Install Git
apt install -y git

# Clone your PolicyBuddies repo
git clone https://github.com/yourname/PolicyBuddies.git
cd PolicyBuddies

# Install dependencies
npm install

# Start API
npm run api:prod
```

### Step 3: Keep Server Running (Background Process)

#### Option A: Screen (Simple)
```bash
screen -S policybuddies
npm run api:prod
# Press Ctrl+A then D to detach
# To reattach: screen -r policybuddies
```

#### Option B: PM2 (Recommended)
```bash
npm install -g pm2

pm2 start src/web/server.js --name "policybuddies-api"
pm2 save
pm2 startup

# Monitor
pm2 logs policybuddies-api
pm2 status
```

#### Option C: Systemd Service
```bash
sudo nano /etc/systemd/system/policybuddies.service
```

Add:
```ini
[Unit]
Description=PolicyBuddies API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/PolicyBuddies
ExecStart=/usr/bin/npm run api:prod
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable policybuddies
sudo systemctl start policybuddies
sudo systemctl status policybuddies
```

### Step 4: Set Up Domain (Optional)
```bash
# Point your domain DNS to droplet IP
# Then access via: https://your-domain.com/api/ask
```

### Step 5: Add HTTPS with Let's Encrypt
```bash
apt install -y certbot

certbot certonly --standalone -d your-domain.com

# Update Nginx config to serve HTTPS
```

### Cost
- **Droplet:** $4–6/month
- **Backups:** $1–2/month
- **Database (if needed):** $12+/month
- **Total:** ~$15–20/month

### Pros & Cons
✅ **Pros:** Cheap, reliable, good documentation  
❌ **Cons:** Requires manual setup and maintenance

---

## Railway

### Prerequisites
- GitHub account with PolicyBuddies repository
- Railway account (free)

### Step 1: Connect Repository
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your PolicyBuddies repository
4. Railway auto-detects it's a Node.js project

### Step 2: Configure Environment
```bash
# In Railway dashboard, add variables:
NODE_ENV=production
PORT=3000
GEMINI_API_KEY=your-key
```

### Step 3: Deploy
```bash
# Push to GitHub
git push origin main

# Railway auto-deploys on push
```

### Step 4: Monitor
```bash
# View logs
railway logs

# View metrics
# Dashboard shows CPU, memory, network
```

### Cost
- **Free tier:** 500 hours/month (~$5 equivalent)
- **Pro:** Pay-per-use ($0.001/hour vCPU)
- **Typical:** $5–15/month

### Pros & Cons
✅ **Pros:** Easiest Git integration, auto-deploy on push, great for development  
❌ **Cons:** Slightly higher cost than DigitalOcean

---

## Oracle Cloud

### Prerequisites
- Oracle Cloud account (always free tier)

### Step 1: Create Compute Instance
```bash
# Via Oracle Cloud Console:
1. Compute → Instances → Create Instance
2. Image: Ubuntu 22.04
3. Shape: Ampere (Free tier eligible)
4. Storage: 200GB free
5. Network: Create VCN
6. SSH Key: Upload your public key
```

### Step 2: Connect
```bash
ssh ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs npm

# Clone & run
git clone https://github.com/yourname/PolicyBuddies.git
cd PolicyBuddies
npm install
npm run api:prod
```

### Step 3: Configure Firewall
```bash
# Allow port 3000
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

### Cost
- **Always Free:** 2 x ARM vCPU, 12GB RAM, 200GB storage
- **Total:** $0/month (truly free, no credit card needed... eventually)

### Pros & Cons
✅ **Pros:** Free forever, no time limit  
❌ **Cons:** Complex UI, manual setup, slow support

---

## AWS

### Step 1: Launch EC2 Instance
```bash
# Via AWS Console or CLI
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t4g.micro \
  --key-name your-key-pair \
  --security-groups default \
  --region us-east-1
```

### Step 2: SSH & Install
```bash
ssh -i your-key.pem ec2-user@your-instance-ip

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Git
sudo yum install -y git

# Clone & run
git clone https://github.com/yourname/PolicyBuddies.git
cd PolicyBuddies
npm install
npm run api:prod
```

### Cost
- **EC2:** $3–5/month (t4g.micro on free tier)
- **EBS:** $2/month (20GB)
- **Total:** $17–28/month

See [AWS Cost Analysis](./AWS-COST-ANALYSIS.md) for details.

---

## Docker Local

### Build Docker Image
```bash
docker build -t policybuddies-api .
```

###Run Locally
```bash
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your-key \
  -v $(pwd)/data:/app/data \
  policybuddies-api
```

### Push to Docker Hub (for cloud deployment)
```bash
docker tag policybuddies-api:latest your-username/policybuddies-api:latest
docker push your-username/policybuddies-api:latest

# Then pull on any cloud platform
docker run your-username/policybuddies-api:latest
```

---

## Production Checklist

Before deploying to production:

- [ ] Environment variables configured (API keys, secrets)
- [ ] Database backup strategy in place
- [ ] Error logging / monitoring enabled
- [ ] Rate limiting configured
- [ ] HTTPS/SSL certificate installed
- [ ] Firewall rules restricted to necessary ports
- [ ] Automated backups enabled
- [ ] Health check monitoring active
- [ ] Documentation updated with running server URL
- [ ] Load testing performed

---

## Recommended Path

1. **Development:** Run locally with `npm run api:dev`
2. **Testing:** Deploy to Railway or DigitalOcean (temporary)
3. **POC:** Choose cheap option (DigitalOcean $4/month)
4. **Production:** Scale to appropriate tier (Railway, AWS, or Custom)

---

## Troubleshooting

### Port 3000 Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Permission Denied on SSH
```bash
# Check SSH key permissions
chmod 600 ~/.ssh/id_ed25519
chmod 700 ~/.ssh
```

### Documents Not Loading After Deploy
```bash
# Ensure data directories exist
mkdir -p data/sources data/extracted-text data/ingestion data/vector-store

# Check file permissions
ls -la data/
```

### API Returns 500 Errors
```bash
# Check logs
screen -r policybuddies  # if using screen
pm2 logs  # if using PM2

# Restart service
npm run api:prod
```

---

## Next Steps

1. Choose your deployment platform
2. Follow the setup steps above
3. Test with `npm run api-client.mjs` or `python3 scripts/api-client.py`
4. Set up monitoring & alerts
5. Configure backups and disaster recovery

**Questions?** See [API.md](./API.md) or [README.md](./README.md)
