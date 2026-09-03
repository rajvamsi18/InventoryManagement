# Grocery Inventory Management App — Architecture & Design

**Project:** InventoryManagement  
**Location:** `/Users/rchen00/Personal/InventoryManagement`  
**Created:** 2026-09-03  
**Status:** Architecture Complete, MVP Ready for Development  

---

## Executive Summary

Building a **Progressive Web App (PWA)** for grocery inventory management that works offline-first and syncs data when connected. The app enables grocery store owners to manually enter product details (name, category, quantity, price) into a local database and backup to a central server when needed.

**Why PWA + Offline-First?**
- Works completely offline (no internet needed at store)
- Shareable via simple link (no app store required)
- Distributable instantly (no installation hassles)
- Data stays on device (grocery owner owns their data)
- Optional sync when needed (not forced to cloud)

---

## Part 1: Architecture Overview

### Architecture Diagram

```
PHASE 1: MVP (SINGLE STORE - YOUR GROCERY)
==========================================

Internet (Global)
    │
    ├─ Grocery Store Owner's Device (Location: Store)
    │  ├─ Browser: Safari / Chrome
    │  ├─ Opens: https://yourname.github.io/inventory-app
    │  ├─ Downloads React PWA (~10-20 MB, one-time)
    │  ├─ Local Storage: SQLite database (in browser)
    │  ├─ Can work OFFLINE: ✅ YES
    │  ├─ Data stored locally: ✅ YES
    │  └─ Sync button (when WiFi available)
    │
    └─ Your Laptop (When Syncing)
       ├─ Same WiFi: 192.168.1.x/24
       ├─ Backend server: FastAPI (port 8000)
       ├─ Database: PostgreSQL (port 5432)
       ├─ Only needed when syncing: ✅ YES
       └─ Runs: uvicorn app.main:app --reload

Communication Flow:
├─ Offline (No WiFi): ✅ App works with local SQLite
├─ WiFi Available:
│  ├─ Grocery device: POST /api/sync (sends local data)
│  ├─ Your backend: Receives data, validates, stores in Postgres
│  ├─ Backup complete: ✅ Data now in two places
│  └─ Grocery device: Updates local cache


PHASE 2: EXPANSION (MULTIPLE STORES - FUTURE)
==============================================

Frontend (Same)
├─ GitHub Pages: hosts React PWA
├─ URL: yourname.github.io/inventory-app
└─ No changes to frontend code

Backend + Database (Migrated to Cloud)
├─ Service: Railway.app ($10/month)
├─ Backend: FastAPI server (always running)
├─ Database: PostgreSQL (always backed up)
└─ Now accessible from ANY store, ANY location

Migration Path: Change 1 API URL in frontend + redeploy
```

---

## Part 2: Technology Stack

### Frontend

```
Language & Framework:
├─ React 19 (TypeScript)
├─ Vite (build tool) — fast dev server
└─ Tailwind CSS (styling)

State Management:
├─ React hooks (useState, useContext)
├─ TanStack Query (optional, for API calls)
└─ Zustand (optional, for global state)

Offline & Local Storage:
├─ Service Worker (offline support)
├─ SQLite (via Dexie.js or sql.js)
│  └─ Dexie recommended (simpler, IndexedDB-based)
└─ Local cache of products

Deployment:
├─ GitHub Pages (FREE)
├─ URL: https://rchen00.github.io/inventory-app
└─ Auto-deploys on push to main branch

Why GitHub Pages?
✅ Free
✅ Simple to set up
✅ Good enough for React PWA
✅ Auto-redeploy on code push
```

### Backend (Local Laptop - Phase 1)

```
Language & Framework:
├─ Python 3.11+
├─ FastAPI (modern, fast, like CP Portal)
└─ Uvicorn (ASGI server)

Database:
├─ PostgreSQL (same as CP Portal)
├─ Local install on Mac (via Homebrew)
└─ Port 5432

API Endpoints (Minimal MVP):
├─ POST /api/sync — Receives sync data from PWA
├─ GET /api/sync-status — Check sync state
└─ GET /api/products — List products (for verification)

Running Locally:
├─ uvicorn app.main:app --reload
├─ Accessible: http://192.168.1.100:8000 (on same WiFi)
└─ Only run when syncing needed

Authentication (MVP Phase):
├─ Skip for Phase 1 (local WiFi, trusted)
├─ Add in Phase 2 (when multi-store)
└─ Use: API keys or JWT tokens

Deployment:
├─ Phase 1: Your laptop (no deployment needed)
├─ Phase 2: Railway.app ($5/month backend, $5/month DB)
└─ No code changes to migrate
```

---

## Part 3: Feature Set (MVP Phase 1)

### User-Facing Features

```
1. Product Entry
   ├─ Form: Product Name (required)
   ├─ Form: Category (dropdown: Vegetables, Fruits, Dairy, etc.)
   ├─ Form: Quantity (number)
   ├─ Form: Price (optional)
   ├─ Form: Unit (kg, pieces, liters, etc.)
   └─ Action: Save to local SQLite ✅

2. Product List
   ├─ Display: All products entered
   ├─ Sort: By category, date added
   ├─ Search: Find product by name
   └─ Edit/Delete: Each product

3. Sync with Store Database
   ├─ Button: "Sync with Backup"
   ├─ Status: Shows last sync time
   ├─ Progress: Syncing... → Complete
   └─ Result: Data backed up to your Postgres ✅

4. Offline Indicator
   ├─ Show: "Offline mode - changes saved locally"
   ├─ Show: When connection regained
   └─ Auto-retry sync if failed

5. Data Export (Phase 1.5)
   ├─ Export: CSV of all products
   └─ Use: For spreadsheets, reports
```

### Technical Features (Backend)

```
1. Sync Endpoint (POST /api/sync)
   ├─ Receives: SQLite data from PWA
   ├─ Validates: Check for duplicates
   ├─ Upsert: Insert or update products
   ├─ Stores in: PostgreSQL
   └─ Returns: {"status": "ok", "synced_count": 42}

2. Conflict Resolution
   ├─ Last-write-wins: If product changed locally + server
   ├─ Timestamp comparison: Newer version wins
   └─ Log: What was merged

3. Error Handling
   ├─ Network timeout: Retry sync later
   ├─ Validation error: Show user message
   ├─ Database error: Log + alert
   └─ Graceful degradation: App works offline anyway
```

---

## Part 4: Development Timeline

### Phase 1: MVP (Your Grocery Store) — 2-3 Weeks

```
Week 1: Frontend Setup
├─ Day 1-2: Create React + Vite project
├─ Day 3-4: Setup Tailwind CSS + basic UI components
├─ Day 5: Setup PWA (Service Worker)
└─ Day 6-7: Implement local SQLite + data entry form

Week 2: Frontend Features
├─ Day 1-2: Product list + search
├─ Day 3-4: Edit/delete functionality
├─ Day 5-6: Offline indicator + error handling
└─ Day 7: Deploy to GitHub Pages

Week 3: Backend + Sync
├─ Day 1-2: Setup FastAPI + local Postgres
├─ Day 3-4: Build /api/sync endpoint
├─ Day 5: Test sync flow end-to-end
├─ Day 6: Add error handling + retries
└─ Day 7: Manual testing + bug fixes

Testing & Refinement:
├─ Unit tests: Frontend components
├─ Integration tests: Sync flow
├─ Manual testing: Your grocery store
└─ Performance: Works on older devices
```

### Phase 2: Scaling (Multiple Stores) — Future

```
Effort: ~1-2 weeks to migrate backend to cloud

Changes Needed:
├─ Backend: Deploy to Railway (no code changes)
├─ Database: Migrate to Railway Postgres (data export/import)
├─ Frontend: Update API_URL constant (1 line change)
├─ Frontend: Redeploy to GitHub Pages
└─ Auth: Add API key / user login (optional)

Cost: $10/month (Railway backend + DB)
```

---

## Part 5: Project Structure

### Repository Layout

```
InventoryManagement/
├─ frontend/                          # React PWA
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ ProductForm.tsx           # Entry form
│  │  │  ├─ ProductList.tsx           # List view
│  │  │  ├─ SyncButton.tsx            # Sync trigger
│  │  │  └─ OfflineIndicator.tsx      # Status
│  │  ├─ hooks/
│  │  │  ├─ useLocalDB.ts             # SQLite hook
│  │  │  ├─ useSync.ts                # Sync logic
│  │  │  └─ useOffline.ts             # Connection state
│  │  ├─ services/
│  │  │  ├─ database.ts               # Dexie setup
│  │  │  └─ api.ts                    # API calls to backend
│  │  ├─ App.tsx                      # Root component
│  │  └─ main.tsx                     # Entry point
│  ├─ public/
│  │  ├─ service-worker.js            # PWA offline support
│  │  ├─ manifest.json                # App metadata
│  │  └─ icons/                       # App icons
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ tsconfig.json
│  ├─ tailwind.config.js
│  └─ .gitignore
│
├─ backend/                           # FastAPI server
│  ├─ app/
│  │  ├─ main.py                      # Entry point
│  │  ├─ routes/
│  │  │  └─ sync.py                   # /api/sync endpoint
│  │  ├─ models/
│  │  │  ├─ product.py                # SQLAlchemy model
│  │  │  └─ sync.py                   # Pydantic schemas
│  │  ├─ services/
│  │  │  └─ sync_service.py           # Business logic
│  │  └─ database/
│  │     ├─ connection.py             # Postgres setup
│  │     └─ migrations/               # DB schema
│  ├─ requirements.txt
│  ├─ .env.example                    # Environment template
│  ├─ run.sh                          # Run script (uvicorn)
│  └─ .gitignore
│
├─ docs/
│  ├─ PROJECT_ARCHITECTURE.md         # This file
│  ├─ SETUP_GUIDE.md                  # Dev environment setup
│  ├─ API_DOCS.md                     # Endpoint documentation
│  └─ DEPLOYMENT.md                   # Deployment instructions
│
├─ README.md                          # Project overview
├─ .gitignore                         # Git ignore rules
└─ git@github.com:rchen00/inventory-app.git  # GitHub remote
```

---

## Part 6: Development Setup (Local Machine)

### Prerequisites

```
macOS (Your current setup):
├─ Node.js 18+ (for React/Vite)
├─ Python 3.11+ (for FastAPI)
├─ PostgreSQL 14+ (local database)
├─ Git (version control)
└─ VS Code (code editor)

Installation:
brew install node@18
brew install python@3.11
brew install postgresql
```

### Local Development Workflow

```
Terminal 1: Frontend (React Dev Server)
cd frontend
npm install
npm run dev
# Opens: http://localhost:5173

Terminal 2: Backend (FastAPI)
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Runs: http://localhost:8000

Terminal 3: PostgreSQL
# Already running via Homebrew services
psql -U postgres
```

### Environment Variables

```
backend/.env:
DATABASE_URL=postgresql://postgres:password@localhost:5432/inventory_db
CORS_ORIGINS=http://localhost:5173,https://rchen00.github.io
LOG_LEVEL=DEBUG
```

---

## Part 7: Deployment Plan

### Frontend Deployment (GitHub Pages)

```
Step 1: Create GitHub Repository
├─ Name: inventory-app
├─ Visibility: Public
└─ Initialize: With README

Step 2: Configure GitHub Pages
├─ Settings → Pages
├─ Deploy from: main branch
├─ Path: /docs or root (depends on build config)
└─ Custom domain: (optional, skip for now)

Step 3: Setup CI/CD (GitHub Actions)
├─ Workflow file: .github/workflows/deploy.yml
├─ Trigger: On push to main branch
├─ Steps:
│  ├─ npm install
│  ├─ npm run build
│  └─ Deploy dist/ to GitHub Pages
└─ Auto-deploys with every push

Result: https://rchen00.github.io/inventory-app
```

### Backend Deployment (Phase 1 - Local)

```
Running on Your Laptop:
├─ Terminal: uvicorn app.main:app --reload
├─ Port: 8000 (on local WiFi: 192.168.1.100:8000)
├─ Database: PostgreSQL (local port 5432)
└─ Accessible to: Same WiFi network only

Safety Notes:
✅ NO port forwarding (doesn't expose to internet)
✅ NO security risk (private network only)
✅ NO ISP blocking (not crossing firewall)
✅ NO dynamic DNS issues (private IP stable)
```

### Backend Deployment (Phase 2 - Cloud Scaling)

```
When Ready to Expand (Multiple Stores):
├─ Service: Railway.app
├─ Deployment:
│  ├─ Connect GitHub repo
│  ├─ Railway auto-deploys on push
│  ├─ Sets up Postgres automatically
│  └─ Creates API endpoint: https://your-app.railway.app
│
├─ Cost:
│  ├─ Backend compute: $5/month
│  ├─ PostgreSQL database: $5/month
│  └─ Total: ~$10/month
│
└─ Migration from Local:
   ├─ Export local Postgres data
   ├─ Import to Railway Postgres
   ├─ Update frontend API_URL (1 line)
   ├─ Push to GitHub
   └─ Auto-redeploys ✅
```

---

## Part 8: Security & Performance

### Security Considerations

```
Phase 1 (MVP - Local WiFi):
├─ Authentication: Not needed (trusted local network)
├─ Encryption: Data at rest (local device storage)
├─ Network: HTTPS not needed (same WiFi, private)
├─ Risk: Very low ✅

Phase 2 (Multi-Store - Internet):
├─ Authentication: Add API key or JWT
├─ Encryption: HTTPS enforced (Railway provides)
├─ Database: Role-based access control
├─ Risk: Managed by Railway infrastructure ✅

What to Avoid:
❌ Port forwarding (internet exposure)
❌ Public database access (open to attacks)
❌ Hardcoded credentials (leaked in repo)
❌ SQL injection (use ORM - SQLAlchemy)
```

### Performance Optimization

```
Frontend:
├─ Service Worker: Caches static files
├─ Code splitting: Load components on-demand
├─ Image optimization: Compress before sync
├─ Database: Index by category, date
└─ Target: <2s initial load, <500ms interactions

Backend:
├─ Database indices: On product_id, created_date
├─ Connection pooling: Reuse DB connections
├─ Async operations: Handle concurrent syncs
└─ Target: <100ms response time for sync

Testing:
├─ Load: Test with 10,000+ products
├─ Latency: Measure sync time
├─ Offline: Verify 100% offline functionality
└─ Battery: Minimal drain on mobile
```

---

## Part 9: Key Architectural Decisions

### Decision 1: PWA vs Native App

```
Why PWA (Progressive Web App)?
✅ Works on mobile, laptop, tablet (same code)
✅ No app store submission needed
✅ Instant distribution via link
✅ Automatic updates (no user action)
✅ Offline-first (works without internet)
✅ Lower development cost (no native teams)
✅ India-friendly (works on any browser)

Not Native (No iOS/Android apps):
❌ Requires App Store/Play Store submission
❌ 1-3 week review process
❌ $100/year Apple developer fee
❌ Separate codebases for iOS/Android
```

### Decision 2: Local SQLite vs Server Database

```
Why Local SQLite (Phase 1)?
✅ Works completely offline
✅ No internet dependency
✅ Fast (no network latency)
✅ Data privacy (stays on device)
✅ Simple (no server complexity)
✅ Perfect for single store

Why Optional Backend Postgres (Phase 2)?
✅ Backup/disaster recovery
✅ Multi-store synchronization
✅ Centralized analytics
✅ Cross-device access
✅ Professional setup
```

### Decision 3: GitHub Pages vs Vercel vs Netlify

```
Why GitHub Pages (Choice for Phase 1)?
✅ FREE forever
✅ Integrated with GitHub
✅ Simple deployment (push = deploy)
✅ Sufficient for PWA
✅ Good enough performance
✅ No vendor lock-in

Vercel/Netlify Differences:
├─ Vercel: Better React optimization (not needed here)
├─ Netlify: Similar features to Vercel
└─ For your app: Overkill, stick with GitHub Pages

Migration Path:
├─ If later need: Easier to switch
├─ Code doesn't change: Just redeploy
└─ Flexible choice
```

---

## Part 10: Questions You Had (Answered)

### Q: Can I sync to my laptop's Postgres?

**A:** Yes, exactly your plan for Phase 1.
```
Setup:
├─ Grocery device: On your home WiFi
├─ Your laptop: Running FastAPI + Postgres
├─ Sync: Same WiFi, when you want
└─ Security: ✅ Safe (local network only)

Risks Avoided:
❌ Port forwarding (internet exposure)
❌ ISP port blocking (not crossing firewall)
❌ Dynamic DNS issues (private IP stable)
```

### Q: What code does grocery owner download?

**A:** Frontend only (React app, not backend).
```
Downloaded (~10-20 MB):
├─ React UI code
├─ Service Worker (offline support)
├─ SQLite database (empty at first)
└─ Styling + icons

NOT Downloaded:
├─ Backend code (FastAPI stays on server)
├─ Database code (Postgres stays on server)
├─ Dependencies (npm modules, Python libs)
└─ No backend exposure to user
```

### Q: Can I update code and redeploy?

**A:** Yes, automatic with every push.
```
Workflow:
1. Make changes in repo
2. git commit + git push origin main
3. GitHub Actions triggers automatically
4. App rebuilds + deploys to GitHub Pages
5. Grocery owner refreshes browser
6. Gets new version automatically ✅

No manual steps needed.
```

### Q: Free hosting in India?

**A:** Yes, all services work globally.
```
✅ GitHub Pages: Works in India
✅ Vercel: Works in India
✅ Netlify: Works in India
✅ Railway: Works in India
✅ Postgres: Works in India

Latency: ~100-150ms (acceptable for grocery app)
```

---

## Part 11: Next Steps

### Immediate (This Week)

```
1. Create GitHub repository
   └─ Name: inventory-app
   └─ URL: github.com/rchen00/inventory-app

2. Initialize project structure
   └─ mkdir frontend backend docs

3. Create frontend (Vite + React)
   ├─ npm create vite@latest frontend -- --template react
   ├─ npm install
   └─ npm run dev (test it works)

4. Setup GitHub Pages
   └─ Settings → Pages → Deploy from main/dist

5. Create backend skeleton
   ├─ mkdir backend
   ├─ python -m venv venv
   ├─ pip install fastapi uvicorn sqlalchemy psycopg2-binary
   └─ Create app/main.py (hello world endpoint)

6. Setup local Postgres
   └─ brew install postgresql
   └─ createdb inventory_db

7. Create comprehensive README
   └─ Explains: How to run locally, deploy, architecture
```

### Week 1-2 (Frontend Development)

```
1. Setup PWA infrastructure
   ├─ Service Worker for offline
   ├─ Manifest.json for app metadata
   └─ PWA icons

2. Setup local database
   ├─ Install Dexie.js (SQLite wrapper)
   ├─ Create database schema
   └─ Test CRUD operations

3. Build UI components
   ├─ ProductForm.tsx
   ├─ ProductList.tsx
   ├─ SyncButton.tsx
   └─ OfflineIndicator.tsx

4. Test offline functionality
   ├─ Turn off WiFi
   ├─ Enter products
   ├─ Verify stored in IndexedDB
   └─ Turn on WiFi → sync ready
```

### Week 3 (Backend + Integration)

```
1. Setup FastAPI backend
   ├─ Create app/main.py
   ├─ Configure CORS (allow localhost:5173)
   ├─ Setup Postgres connection

2. Implement sync endpoint
   ├─ POST /api/sync
   ├─ Receive SQLite data
   ├─ Upsert to Postgres
   └─ Return status

3. End-to-end testing
   ├─ Add 10 products in PWA
   ├─ Click "Sync"
   ├─ Verify in Postgres
   └─ Update product → sync again
   └─ Verify updated

4. Deploy to GitHub Pages
   └─ Push to GitHub
   └─ Enable GitHub Pages
   └─ Share URL with yourself for testing
```

---

## Part 12: Success Criteria (MVP Complete)

```
✅ Frontend:
   ├─ App loads offline
   ├─ Add product form works
   ├─ Products persist in IndexedDB
   ├─ Search/filter works
   ├─ Edit/delete products works
   ├─ PWA install-able (add to home screen)
   └─ Works on mobile + laptop

✅ Backend:
   ├─ FastAPI server runs locally
   ├─ Postgres connects and stores data
   ├─ /api/sync endpoint receives data
   ├─ Data upserts correctly
   └─ Error handling works

✅ Integration:
   ├─ Add product in PWA
   ├─ Click "Sync" button
   ├─ Data appears in Postgres
   ├─ Grocery owner can use app offline
   └─ No crashes or errors

✅ Deployment:
   ├─ React app deployed to GitHub Pages
   ├─ Public URL works
   ├─ Can share with friend via link
   ├─ Friend can use offline
   └─ Auto-updates on code push

Phase 1 Complete: ✅
```

---

## Glossary & Quick Reference

```
Term                    | Definition
PWA                     | Progressive Web App (web app that works offline)
SQLite                  | Local database that runs in browser
IndexedDB               | Browser's local storage (where SQLite lives)
Service Worker          | Background script that enables offline mode
GitHub Pages            | Free static file hosting by GitHub
FastAPI                 | Python web framework (like Flask but modern)
PostgreSQL              | Powerful database (same as CP Portal)
CORS                    | Allows frontend to call backend API
Sync                    | Upload local data to server for backup
Dexie.js                | Wrapper around IndexedDB (easier to use)
Vite                    | Fast build tool for React (like Webpack)
UX                      | User Experience (how app feels to user)
```

---

## Helpful Resources

```
Frontend:
├─ React: react.dev
├─ Vite: vitejs.dev
├─ Tailwind: tailwindcss.com
├─ Dexie: dexie.org
├─ Service Workers: web.dev/service-workers
└─ PWA: web.dev/progressive-web-apps

Backend:
├─ FastAPI: fastapi.tiangolo.com
├─ SQLAlchemy: sqlalchemy.org
├─ PostgreSQL: postgresql.org
└─ Uvicorn: uvicorn.org

Deployment:
├─ GitHub Pages: pages.github.com
├─ Railway: railway.app
├─ GitHub Actions: github.com/features/actions

Architecture:
├─ This repo: /Users/rchen00/Personal/InventoryManagement
├─ Session notes: (stored in session memory)
└─ Context: Refer to PROJECT_ARCHITECTURE.md
```

---

## Session Context (For Next Copilot Session)

This document captures everything from the architecture discussion. When starting a new Copilot session:

1. Open this file in the editor
2. Use the prompt below to sync Copilot with project context
3. Copilot will read this file and understand:
   - Why we chose PWA over native apps
   - Why local database + optional backend
   - Why GitHub Pages + local FastAPI
   - Phase 1 vs Phase 2 architecture
   - Complete development plan
   - Repository structure
   - All previous decisions and reasoning

---

## End of Architecture Document

**Status:** ✅ Architecture Finalized  
**Next:** Follow "Immediate Next Steps" section to begin development  
**Questions:** Refer to this doc + session memory for context
