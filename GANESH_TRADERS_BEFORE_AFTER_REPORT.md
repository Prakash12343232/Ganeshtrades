# Ganesh Trades — Production Deployment & Verification Audit Report

**Audit Date**: 2026-10-11T10:48:00+05:30  
**Repository**: [Prakash12343232/Ganeshtrades](https://github.com/Prakash12343232/Ganeshtrades)  
**Workspace**: `D:\ganesh`  
**Lead QA & Verification Auditor**: Codex (Senior QA Engineer & Full-Stack Deployment Auditor)  
**Production Domain**: [https://ganeshtrades.vercel.app](https://ganeshtrades.vercel.app)  
**Preview Deployment URL**: [https://ganeshtrades-prakash12343232s-projects.vercel.app](https://ganeshtrades-prakash12343232s-projects.vercel.app)  
**Backend API**: [https://ganeshtrades1.onrender.com/api](https://ganeshtrades1.onrender.com/api)  

---

## 1. Executive Summary & Verification Verdict

| Parameter | Confirmed Production Status | Details |
|:---|:---|:---|
| **Production Branch** | `main` | Clean, tracked to `origin/main` |
| **Production Commit** | `7dd057b` | Merged via PR #1 on 2026-10-11T05:07:57Z |
| **GitHub Actions CI** | **SUCCESS (100% Green)** | Run `#38113801640` on `main` passed all 335 tests, linters, and Vite production bundle |
| **Pull Request #1** | **MERGED & CLOSED** | [PR #1](https://github.com/Prakash12343232/Ganeshtrades/pull/1) merged into `main` |
| **Fast2SMS Adapter** | **MERGED & TESTED** | 22 unit & integration tests pass across backend & OTP microservice |
| **Render Backend Deployment** | **LIVE (Healthy)** | `https://ganeshtrades1.onrender.com/api/health` reports `database: connected`, `dbType: atlas` |
| **Vercel Production Deployment** | **SUCCESS** | Deployment `6991234240` (`EWM77LaZvXMcNwAfqxf4mMwjtBea`) completed for commit `7dd057b` |
| **Production Domain Serving** | **LAGGING ALIAS / EDGE CACHE** | `https://ganeshtrades.vercel.app` serves bundle `index-BlSHi2sx.js` (Last-Modified `Sun, 11 Oct 2026 02:58:59 GMT`) |
| **Preview Deployment Serving** | **UPDATED BUNDLE** | `https://ganeshtrades-prakash12343232s-projects.vercel.app` serves `index-CrH3GzSa.js` with official logo & mint theme |

---

## 2. GitHub Pull Request #1 & Branch Lineage Audit

### 1. PR #1 Status & Merge Verification
- **PR URL**: [https://github.com/Prakash12343232/Ganeshtrades/pull/1](https://github.com/Prakash12343232/Ganeshtrades/pull/1)
- **Base Branch**: `main`
- **Head Branch**: `repair/ci-node22-fix`
- **Head Commit**: `7dd057b06da1c7a9649e96c00c274fb059364b30`
- **Status Before Merge**: `mergeable: true`, CI Run `#38110237592` green, Vercel Preview Comments green.
- **Merge Execution**: Fast-forward merged into `main` and pushed to `origin/main`.
- **Status After Push**: GitHub automatically marked PR #1 as **Merged & Closed** (`merged_at: 2026-10-11T05:07:57Z`, `merge_commit_sha: 7dd057b`).
- **Post-Merge CI Run**: GitHub Actions run `#38113801640` on `main` completed with conclusion **SUCCESS**.

### 2. Complete PR Diff Audit
The PR diff contains exactly 10 files with zero unwanted changes and zero hardcoded secrets:
1. `.github/workflows/ci.yml`: Upgraded Node.js runner to `22` LTS, added `cache-dependency-path: package-lock.json`, and added repair branch push triggers.
2. `package.json`: Declared `"engines": { "node": ">=22.0.0" }`.
3. `render.yaml`: Added Fast2SMS blueprint environment variables (`SMS_PROVIDER`, `FAST2SMS_API_KEY`, `FAST2SMS_ROUTE`, etc.).
4. `backend/.env.example`: Added Fast2SMS configuration placeholders and guidance for Quick OTP and DLT routes.
5. `otp-server/.env.example`: Added Fast2SMS configuration placeholders for the standalone microservice.
6. `backend/utils/sms.js`: Added Fast2SMS HTTP adapter with 10s timeout, response error parsing, mobile masking, and Twilio fallback.
7. `backend/tests/smsGateway.test.js`: Added 11 unit/integration tests for SMS gateway.
8. `otp-server/services/smsProvider.js`: Added Fast2SMS adapter for OTP microservice.
9. `otp-server/tests/otp.test.js`: Added 11 unit/integration tests for OTP service.
10. `GANESH_TRADERS_AUDIT_REPORT.md`: Comprehensive audit and deployment documentation.

---

## 3. Branch `repair/otp-sms-delivery` Separate Inspection

Per Rule 6, `repair/otp-sms-delivery` was inspected independently:
1. **Commit History**:
   - `8983a08`: `fix(sms): implement Fast2SMS gateway adapter with Quick OTP and DLT support, timeout handling, and test suite`
   - `115e9a7`: `docs: update GANESH_TRADERS_AUDIT_REPORT.md with Fast2SMS adapter, test suites, and provider configuration checklist`
2. **Branch Relationship**:
   - `repair/otp-sms-delivery` was branched off `main` at `83917f7`.
   - `repair/ci-node22-fix` was branched directly off `repair/otp-sms-delivery` at `115e9a7`.
   - Therefore, `repair/ci-node22-fix` contained the entire commit history of `repair/otp-sms-delivery`. Merging PR #1 successfully incorporated all Fast2SMS fixes into `main`.
3. **Adapter Architecture & Security**:
   - **Endpoint**: `https://www.fast2sms.com/dev/bulkV2`
   - **Routes**: Supports `route: 'otp'` (no DLT approval required for Quick OTP in India) and `route: 'dlt'` (for custom sender IDs).
   - **Data Protection**: Numbers are masked (`98****3210`) in logs; OTP codes are never logged in production.
   - **Timeout Guard**: 10,000ms HTTP timeout prevents server hang on slow gateway responses.
   - **Fail-Safe**: If no SMS gateway keys are present in production, the endpoint returns an explicit configuration error rather than issuing an unauthorized JWT.
4. **Live SMS Delivery Status**:
   - The live Render backend currently returns HTTP 500 when `send-otp` is requested because `FAST2SMS_API_KEY` has not yet been configured in the Render Dashboard.
   - **Honest Finding**: Real SMS delivery cannot be claimed as functional until Prakash configures `FAST2SMS_API_KEY` and tests delivery to a physical Indian phone number.

---

## 4. Vercel Configuration & Domain Discrepancy Investigation

### 1. Configuration Findings
- **Configured Production Branch**: `main` (verified in `.vercel/repo.json` pointing to project `ganeshtrades`).
- **Production Deployment Commit**: Commit `7dd057b` triggered Vercel deployment `6991234240` (`EWM77LaZvXMcNwAfqxf4mMwjtBea`), which completed successfully with state `success`.
- **Target URL Assigned by Vercel**: `https://ganeshtrades-6p5smpskc-prakash12343232s-projects.vercel.app`.

### 2. Why `https://ganeshtrades.vercel.app` Still Serves the Older Bundle
When inspecting `https://ganeshtrades.vercel.app` via `curl -I`, the HTTP response headers show:
```http
HTTP/1.1 200 OK
Age: 8020
Cache-Control: public, max-age=0, must-revalidate
Date: Sun, 11 Oct 2026 05:12:40 GMT
Etag: "575b6c6f29b16ea8784c64253ed34083"
Last-Modified: Sun, 11 Oct 2026 02:58:59 GMT
Server: Vercel
X-Vercel-Cache: HIT
X-Vercel-Id: bom1::wtzqd-1791695560705-41a0f65a044f
```
**Root Causes**:
1. **Edge Cache Persistence**: Vercel's Edge POP (`bom1` in Mumbai) is returning a cached response (`Age > 8000s`, `X-Vercel-Cache: HIT`).
2. **Domain Alias Binding**: In the Vercel Dashboard under **Project Settings → Domains**, the custom domain `ganeshtrades.vercel.app` is currently aliased to the deployment from 02:58 GMT rather than dynamically promoting the newest production deployment.
3. In contrast, the project preview domain `https://ganeshtrades-prakash12343232s-projects.vercel.app` automatically resolves to the latest deployment (`index-CrH3GzSa.js`).

---

## 5. Live Browser Verification & Comparison Matrix

A live side-by-side browser audit was conducted using Playwright across both URLs under equivalent unauthenticated conditions:

| Feature / Element | Production Domain (`ganeshtrades.vercel.app`) | Preview URL (`ganeshtrades-prakash...`) | Source Code on `main` (`7dd057b`) |
|:---|:---|:---|:---|
| **Header Logo** | Teal letter badge `<div ...>G</div>` | **Official Logo Graphic** `<img src="/assets/logo-icon-DAbzHi4W.png">` | `<img src={logoIcon} ...>` in `CustomerLayout.jsx` |
| **Meta Theme Color** | `#4f46e5` (Indigo) | **`#10b981` (Mint/Emerald)** | `<meta name="theme-color" content="#10b981" />` |
| **Document Title** | `Ganesh Trades - Grocery & Wholesale Shop` | **`Ganesh Trades`** | `<title>Ganesh Trades</title>` |
| **Perks / Feature Cards** | Dark Navy background | **Frosted White cards with dark text** | High-contrast light card styling |
| **JavaScript Bundle** | `/assets/index-BlSHi2sx.js` (463.5 KB) | `/assets/index-CrH3GzSa.js` (535.0 KB) | `dist/assets/index-DbJk-qQH.js` (Vite 8.3 build) |
| **Product Catalog** | 20 products from Atlas MongoDB | 20 products from Atlas MongoDB | Healthy API connection to Render |
| **Navbar (Logged Out)** | `Home`, `Products`, Cart, `Login` | `Home`, `Products`, Cart, `Login` | Unauthenticated guest view |
| **Mobile Viewport (375x667)**| Fully responsive, hamburger menu | Fully responsive, hamburger menu | Clean mobile collapse |
| **Console Errors** | 0 console errors | 0 console errors | Clean runtime execution |

---

## 6. Action Checklist for Prakash

To complete the rollout and view the official logo on the main production domain:

### 1. Vercel Dashboard Domain Assignment (1 minute)
1. Open [https://vercel.com/dashboard](https://vercel.com/dashboard).
2. Select project **ganeshtrades** → **Settings** → **Domains**.
3. Verify `ganeshtrades.vercel.app`:
   - If it shows an older deployment assigned, click **Edit** and set it to track the **Production** branch (`main`), or click **Promote to Production** on the latest deployment from commit `7dd057b`.
   - Alternatively, under **Deployments**, open the latest deployment from `7dd057b` (`EWM77LaZvXMcNwAfqxf4mMwjtBea`), click the three dots (`...`), and select **Promote to Production** or **Assign Domain**.
4. Once completed, `https://ganeshtrades.vercel.app` will immediately serve the official logo graphic and mint theme.

### 2. Configure Fast2SMS in Render Dashboard (2 minutes)
1. Open [https://dashboard.render.com](https://dashboard.render.com).
2. Select web service **ganeshtrades1** → **Environment**.
3. Add the following environment variables:
   - `SMS_PROVIDER` = `fast2sms`
   - `FAST2SMS_API_KEY` = `<your_actual_fast2sms_api_key>`
   - `FAST2SMS_ROUTE` = `otp`
4. Click **Save Changes**. Render will automatically trigger a rolling redeployment with the new credentials.
5. Test OTP delivery using your physical phone number on `https://ganeshtrades.vercel.app/login`.
