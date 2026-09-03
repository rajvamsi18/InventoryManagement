# PROMPT FOR NEXT COPILOT SESSION

**Use this prompt to start fresh in a new Copilot window/session:**

---

## 🚀 FULL CONTEXT PROMPT (Copy & Paste into Copilot Chat)

```
I'm building a Grocery Inventory Management PWA with offline-first architecture. 

FIRST: Please read PROJECT_ARCHITECTURE.md COMPLETELY to understand:
1. Our architecture decisions (PWA, local SQLite, optional backend)
2. Why we chose GitHub Pages + FastAPI
3. Phase 1 (MVP for my grocery) vs Phase 2 (multi-store scaling)
4. Complete technology stack
5. Development timeline and next steps
6. Project structure and all key decisions

Then help me with: [YOUR SPECIFIC TASK]

Key Context:
- Frontend: React 19 + TypeScript + Vite + Tailwind + Dexie.js (SQLite in browser)
- Backend: FastAPI (Python) - runs locally on my laptop
- Database: PostgreSQL (local in Phase 1, Railway in Phase 2)
- Hosting: GitHub Pages (frontend) + local laptop (backend)
- Goal: Work completely offline, optional sync via WiFi
- Timeline: 2-3 weeks for MVP

This is critical for understanding why we made certain trade-offs.
```

---

## 📋 QUICK TASK PROMPTS (For Specific Work)

### After Reading Architecture, Use These:

**For Frontend Setup:**
```
I've read PROJECT_ARCHITECTURE.md. Now help me:

1. Set up the React + Vite project with Tailwind CSS
2. Create the folder structure for components, hooks, services
3. Set up Dexie.js for local SQLite database
4. Create ProductForm, ProductList, SyncButton, OfflineIndicator components
5. Test that it runs locally on http://localhost:5173

The architecture shows I need offline-first PWA. Current task: [SPECIFIC WORK]
```

**For Backend Setup:**
```
I've read PROJECT_ARCHITECTURE.md. Now help me:

1. Set up FastAPI project with proper folder structure
2. Configure PostgreSQL connection
3. Create the Product model and Sync schema
4. Implement POST /api/sync endpoint
5. Add CORS configuration for localhost:5173

The architecture shows local Phase 1 sync. Current task: [SPECIFIC WORK]
```

**For Database Setup:**
```
I've read PROJECT_ARCHITECTURE.md. Now help me:

1. Create PostgreSQL database: inventory_db
2. Design Product table schema (name, category, quantity, price, unit, created_at, updated_at)
3. Add indexes for performance
4. Create setup script (run once)

Architecture shows local Postgres for Phase 1. Current task: [SPECIFIC WORK]
```

**For Frontend-Backend Integration:**
```
I've read PROJECT_ARCHITECTURE.md. Now help me:

1. Create API service that posts sync data to backend
2. Handle sync button click → sends IndexedDB data
3. Add error handling and retry logic
4. Show sync status (syncing... → success/error)
5. Test end-to-end: add product → sync → verify in Postgres

Architecture shows PWA ↔ FastAPI sync flow. Current task: [SPECIFIC WORK]
```

**For Deployment:**
```
I've read PROJECT_ARCHITECTURE.md. Now help me:

1. Set up GitHub Pages deployment for React app
2. Create GitHub Actions workflow (npm install → npm build → deploy)
3. Verify auto-deploy works on every push
4. Get the public GitHub Pages URL
5. Test that someone else can download and use the app offline

Architecture shows Phase 1 is GitHub Pages frontend + local backend. Current task: [SPECIFIC WORK]
```

---

## 🎯 HOW TO USE THIS

### Session 1 (Now - Setting Up Context):
✅ Create repo at `/Users/rchen00/Personal/InventoryManagement`  
✅ Create PROJECT_ARCHITECTURE.md (ALL decisions documented)  
✅ Create README.md  
✅ Initialize git  
✅ Ready for development

### Session 2 (Next - Frontend Development):
1. Open VS Code → Open `/Users/rchen00/Personal/InventoryManagement` folder
2. Open Copilot Chat
3. Copy the "FULL CONTEXT PROMPT" above
4. Paste into Copilot Chat
5. Once it reads architecture, use "For Frontend Setup" prompt
6. Follow its guidance to build React components

### Session 3+ (Backend, Integration, Deployment):
1. Same process
2. Read PROJECT_ARCHITECTURE.md (it refers to itself)
3. Use appropriate task prompt above
4. Continue development

---

## 📚 DOCUMENT HIERARCHY

```
/Users/rchen00/Personal/InventoryManagement/
├─ README.md                    ← Start here (quick overview)
├─ PROJECT_ARCHITECTURE.md      ← Then read this (everything)
├─ .github/workflows/           ← GitHub Actions (auto-deploy)
├─ frontend/                    ← React app
│  └─ src/
│     ├─ components/            ← ProductForm, ProductList, etc.
│     ├─ hooks/                 ← useLocalDB, useSync, etc.
│     ├─ services/              ← database.ts, api.ts
│     └─ main.tsx
├─ backend/                     ← FastAPI app
│  └─ app/
│     ├─ routes/                ← /api/sync endpoint
│     ├─ models/                ← Product model
│     └─ main.py
└─ docs/                        ← Additional docs (create as needed)
   ├─ SETUP_GUIDE.md            ← Step-by-step local dev setup
   ├─ API_DOCS.md               ← Endpoint documentation
   └─ DEPLOYMENT.md             ← Deployment instructions
```

---

## ⚡ COMMON NEXT STEPS

After reading PROJECT_ARCHITECTURE.md, typically:

1. **This week:** 
   - Frontend setup (React + Vite + Tailwind)
   - Local database (Dexie.js)
   - Basic UI components

2. **Next week:**
   - Backend setup (FastAPI + Postgres)
   - Sync endpoint
   - Integration testing

3. **Week 3:**
   - Full end-to-end testing
   - GitHub Pages deployment
   - Bug fixes & polish

---

## 🔑 KEY REMINDERS

✅ **Everything is documented in PROJECT_ARCHITECTURE.md**
✅ **Always start new sessions with the FULL CONTEXT PROMPT**
✅ **Refer back to architecture for decisions**
✅ **Phase 1 = Local MVP (your grocery)**
✅ **Phase 2 = Cloud scaling (when expanding)**

---

**Created:** 2026-09-03  
**For:** Next Copilot session onboarding  
**Location:** `/Users/rchen00/Personal/InventoryManagement`
