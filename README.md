# Grocery Inventory Management App

A Progressive Web App (PWA) for grocery store inventory management with offline-first architecture and optional sync to central database.

## Quick Start

**For detailed architecture and design decisions, see:** [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md)

### What Is This?

- **PWA app** for grocery store owners to manage product inventory
- **Offline-first**: Works completely offline, no internet needed
- **Local database**: Data stored on user's device (browser IndexedDB)
- **Optional sync**: When WiFi available, backup data to your Postgres database
- **Shareable**: One link, works on mobile/laptop/tablet

### Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Local Database:** IndexedDB (via Dexie.js in browser)
- **Backend:** FastAPI (Python)
- **Cloud Database:** PostgreSQL
- **Hosting:** GitHub Pages (frontend) + Local laptop/Railway (backend)

### Project Structure

```
frontend/          # React PWA (deployed to GitHub Pages)
backend/           # FastAPI backend (runs local or on Railway)
docs/              # Documentation
PROJECT_ARCHITECTURE.md  # Full architecture & design
```

### Local Development

```bash
# Terminal 1: Frontend
cd frontend
npm install
npm run dev
# Opens http://localhost:5173

# Terminal 2: Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# Runs http://localhost:8000

# Terminal 3: Database
# PostgreSQL should be running (via Homebrew services)
```

### Deployment

- **Frontend:** Push to GitHub → auto-deploys to GitHub Pages
- **Backend Phase 1:** Run locally (same WiFi as grocery store)
- **Backend Phase 2:** Deploy to Railway.app when expanding to multiple stores

## Phase 1: MVP (Your Grocery Store)

See [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md#part-4-development-timeline) for detailed timeline.

**Goal:** Working PWA that syncs to your local Postgres database

**Timeline:** 2-3 weeks

## Phase 2: Scaling (Multiple Stores)

**When ready:** Migrate backend to Railway (~$10/month), update frontend API URL (1 line), redeploy.

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **App Type** | PWA | Works offline, shareable, no app store |
| **Local DB** | IndexedDB (Dexie.js) | Offline, private, simple |
| **Backend** | FastAPI (Python) | Fast, modern, like CP Portal |
| **Hosting** | GitHub Pages + local | Free, simple, scales later |
| **Sync** | Optional when WiFi | User chooses, not forced |

## Architecture Overview

```
Grocery Owner's Device (Offline)
    ↓ (Has local IndexedDB)
    ↓ (When WiFi available + sync button)
Your Laptop/Railway Backend
    ↓ (Validates, stores in Postgres)
Backup/Archive
```

## Next Steps

1. **Start here:** Read [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md)
2. **Setup:** Follow "Immediate (This Week)" section
3. **Develop:** Start with frontend, then backend
4. **Test:** Use your own store as first user
5. **Expand:** When ready, migrate backend to Railway

## Important Notes

✅ **Phase 1 is local-only** (your laptop + same WiFi)
✅ **No internet required** for grocery owner
✅ **Data stays on device** (privacy first)
✅ **Auto-deploy frontend** (every GitHub push)
⚠️ **Backend stays local** (only sync when you run it)
🔒 **Very safe** (no port forwarding, no ISP issues, no security risk)

## Resources

- Full architecture: [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md)
- Setup guide: [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) (create next)
- API docs: [`docs/API_DOCS.md`](docs/API_DOCS.md) (create next)
- Deployment: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (create next)

## Session Context

This repo captures **all architectural decisions** from the planning session. 

When starting a new Copilot session, use this prompt:

```
Please read PROJECT_ARCHITECTURE.md completely to understand:
1. Why we chose PWA over native apps
2. Why local database + optional backend
3. Why GitHub Pages + local FastAPI
4. Phase 1 vs Phase 2 architecture
5. Complete development plan
6. Repository structure and decisions

Then help me with [YOUR SPECIFIC TASK].
```

---

**Created:** 2026-09-03  
**Status:** Architecture Complete, Ready for Development  
**Location:** `/Users/rchen00/Personal/InventoryManagement`
