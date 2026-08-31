# Ganesh Trades — Deployment & CI/CD Guide

## Architecture Overview

```
Developer pushes code
        ↓
  GitHub (main branch)
        ↓
  GitHub Actions CI validates
        ↓
  ┌─────────────┬─────────────┐
  │   Vercel    │   Render    │
  │  (frontend) │  (backend)  │
  └─────┬───────┴──────┬──────┘
        ↓              ↓
  React SPA        Express API
                       ↓
                 MongoDB Atlas
```

| Component | Platform | URL |
|:--|:--|:--|
| Frontend | Vercel | `https://ganeshtrades.vercel.app` |
| Backend API | Render | `https://ganeshtrades1.onrender.com/api` |
| Database | MongoDB Atlas | (Atlas dashboard) |
| CI/CD | GitHub Actions | `.github/workflows/ci.yml` |

---

## Automatic Deployment Flow

After setup, the workflow is fully automatic:

1. **Push code** to `main` branch on GitHub.
2. **GitHub Actions CI** runs: installs dependencies, runs backend tests, lints frontend, builds frontend.
3. **Vercel** detects the push and auto-deploys the frontend.
4. **Render** detects the push and auto-deploys the backend (only when `backend/**` files change).
5. **Production** is updated automatically. No manual "Deploy" button needed.

Preview deployments are also created automatically by Vercel for pull requests.

---

## 1. Vercel Setup (Frontend)

### Initial Setup (one-time)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard).
2. Import the GitHub repository: `Prakash12343232/Ganeshtrades`.
3. **Root Directory**: Leave as `.` (root). The `vercel.json` at root uses `--prefix frontend`.
4. **Framework Preset**: Vite (auto-detected).
5. Vercel will auto-detect the `vercel.json` configuration:
   - Build command: `npm install --prefix frontend && npm run build --prefix frontend`
   - Output directory: `frontend/dist`

### Environment Variables (Vercel Dashboard)

Go to **Project Settings → Environment Variables** and add:

| Variable | Value | Scope |
|:--|:--|:--|
| `VITE_API_URL` | `https://ganeshtrades1.onrender.com/api` | Production |

> ⚠️ **Never add** `MONGODB_URI`, `JWT_SECRET`, or any backend secrets to Vercel.

### Auto-Deploy Verification

- **Settings → Git**: Should show connected to `Prakash12343232/Ganeshtrades`.
- **Production Branch**: `main`.
- **Auto-Deploy**: Enabled (default when connected to GitHub).

---

## 2. Render Setup (Backend)

### Initial Setup (one-time)

1. Go to [Render Dashboard](https://dashboard.render.com/).
2. Create a new **Web Service** connected to `Prakash12343232/Ganeshtrades`.
3. Render will auto-detect the `render.yaml` blueprint:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check: `/api/health`
   - Build Filter: `backend/**` (only rebuilds when backend files change)
   - Auto-Deploy: Yes

### Environment Variables (Render Dashboard)

These are configured in `render.yaml` (committed to repo):

| Variable | Value | In `render.yaml`? |
|:--|:--|:--|
| `NODE_ENV` | `production` | ✅ |
| `PORT` | `5000` | ✅ |
| `FRONTEND_URL` | `https://ganeshtrades.vercel.app,...` | ✅ |
| `JWT_EXPIRE` | `7d` | ✅ |

These **must be set manually** in Render Dashboard → Environment (secrets, not in code):

| Variable | Value | Notes |
|:--|:--|:--|
| `MONGODB_URI` | `mongodb+srv://...` | Your Atlas connection string |
| `JWT_SECRET` | `(random ≥32 chars)` | Generate with `openssl rand -base64 32` |

### Auto-Deploy Verification

- **Settings → Build & Deploy → Auto-Deploy**: Should say "Yes".
- **Settings → Build & Deploy → Branch**: `main`.
- **Settings → Build & Deploy → Root Directory**: `backend`.

---

## 3. GitHub Actions CI

The CI pipeline (`.github/workflows/ci.yml`) runs on every push to `main` and on pull requests.

### What it validates:

| Step | What it checks |
|:--|:--|
| Install backend deps | `npm ci` in `backend/` |
| Validate backend syntax | `node --check server.js` |
| Run backend tests | Jest + Supertest + MongoMemoryServer |
| Install frontend deps | `npm ci` in `frontend/` |
| Lint frontend | `oxlint` (non-blocking) |
| Build frontend | `vite build` with `VITE_API_URL` |

### No secrets needed in CI:

- Tests use `MongoMemoryServer` (in-memory database).
- JWT secret uses a CI placeholder.
- `VITE_API_URL` is set as a build-time env var.

---

## 4. Health Check

**Endpoint**: `GET https://ganeshtrades1.onrender.com/api/health`

**Response**:
```json
{
  "success": true,
  "message": "Ganesh Trades API is running",
  "environment": "production",
  "database": "connected",
  "timestamp": "2026-09-01T..."
}
```

Render monitors this endpoint automatically. If it returns unhealthy, Render will not promote the new deployment.

---

## 5. Database Safety

- Production `connectDB()` exits with `process.exit(1)` if MongoDB Atlas is unreachable.
- In-memory fallback **only** runs in development/local mode.
- No seed scripts run automatically in production.
- No database reset happens during deployment.
- Backups are cron-scheduled (daily/weekly/monthly) but write to ephemeral Render storage — consider external backup for persistence.

---

## 6. Cron Jobs / Background Jobs

| Job | Schedule | What it does |
|:--|:--|:--|
| Daily backup | 2:00 AM | Backs up all collections to JSON |
| Weekly backup | Sunday 3:00 AM | Full weekly backup |
| Monthly backup | 1st of month 4:00 AM | Full monthly backup |
| Delivery reminders | Every hour | Notifies customers about upcoming deliveries |
| Late delivery alerts | 10:00 AM daily | Alerts admin about overdue deliveries |
| Payment reminders | 9:00 AM daily | Reminds customers with pending balances |

**Important notes**:
- Cron jobs run in-process via `node-cron`. They stop when the server stops and restart when it restarts.
- On Render redeploy, the old process is killed gracefully → new process starts → cron reinitializes. **No duplicates**.
- If you need persistent, durable cron jobs, consider a dedicated Render Cron Job service or an external scheduler.
- Backup files are stored on Render's ephemeral filesystem and will be lost on redeploy.

---

## 7. CORS Configuration

The backend dynamically builds the CORS allowlist:

1. `FRONTEND_URL` env var (comma-separated URLs).
2. `RENDER_EXTERNAL_URL` (set automatically by Render).
3. `VERCEL_URL` (if set).
4. Safety net: any `*.onrender.com` or `*.vercel.app` origin in production.
5. `localhost` origins only in development.

---

## 8. Rollback Procedures

### Identify a Failed Deployment

- **Vercel**: Dashboard → Deployments → look for red/failed status.
- **Render**: Dashboard → Events → look for deploy failure.
- **GitHub Actions**: Repository → Actions tab → look for failed workflow runs.

### Revert to Previous Commit

```bash
# Revert the last commit
git revert HEAD
git push origin main

# This triggers a new deployment with the reverted code
```

### Redeploy Previous Version (without code change)

- **Vercel**: Dashboard → Deployments → find the last working deployment → ⋯ → "Promote to Production".
- **Render**: Dashboard → Events → find the last successful deploy → "Rollback" (or Manual Deploy with a specific commit).

### Emergency: Force Deploy a Specific Commit

```bash
# Reset to a known good commit (use with caution)
git reset --hard <good-commit-sha>
git push --force origin main
```

---

## 9. Troubleshooting

| Problem | Check |
|:--|:--|
| Frontend shows blank page | Verify `VITE_API_URL` is set in Vercel env vars |
| CORS errors in browser | Check `FRONTEND_URL` in Render env vars matches actual Vercel domain |
| API returns 500 | Check Render logs for MongoDB connection errors |
| Login fails after deploy | Verify `JWT_SECRET` hasn't changed between deploys |
| Vercel not auto-deploying | Verify GitHub integration in Vercel Dashboard → Settings → Git |
| Render not auto-deploying | Verify Auto-Deploy is "Yes" in Render Dashboard |
| Backend changes not triggering Render | Build filter is `backend/**` — ensure changes are in that directory |
| CI tests fail | Check GitHub Actions logs; tests use MongoMemoryServer (no real DB) |

---

## 10. File Structure Reference

```
Ganeshtrades/
├── .github/workflows/ci.yml    # CI pipeline
├── frontend/                    # React + Vite (deployed to Vercel)
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── backend/                     # Express API (deployed to Render)
│   ├── server.js
│   ├── config/
│   ├── routes/
│   ├── models/
│   ├── tests/
│   └── package.json
├── vercel.json                  # Vercel build config (monorepo root)
├── render.yaml                  # Render blueprint (points to backend/)
├── package.json                 # Root scripts (dev convenience)
└── DEPLOYMENT.md                # This file
```
