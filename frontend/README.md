# ELEKEZA Frontend

Frontend for the ELEKEZA adaptive literacy platform, built with Next.js (App Router), React, TypeScript, and Tailwind CSS.

## What this app does

- User authentication (register/login)
- Onboarding flow
- Content upload
- Lesson and quiz pages
- Dashboard, history, settings
- Accessibility preferences persisted across pages

## Prerequisites

- Node.js `20+` (recommended: latest LTS)
- npm `10+`
- Backend running on `http://localhost:8080`

## Quick Start

1. Open terminal in `frontend/`
2. Install dependencies:

```bash
npm install
```

3. Start development server:

```bash
npm run dev
```

4. Open:

`http://localhost:3000`

## API Proxy (Important)

Frontend requests use same-origin `/api/...` and are proxied by Next.js to backend:

- Source: `/api/:path*`
- Destination: `http://localhost:8080/api/:path*`

Config location:

- `frontend/next.config.ts`

If backend URL changes, update that file and restart `npm run dev`.

## Scripts

```bash
npm run dev    # start local dev server
npm run build  # production build
npm run start  # run production server
npm run lint   # lint project
```

## Project Docs

- User-accessible pages: `frontend/USER_ACCESSIBLE_PAGES.md`
- Pages + API reference: `frontend/APP_PAGES_AND_API.md`

## Common Issues

### 1. Login/Register not working

- Ensure backend is running on `http://localhost:8080`
- Restart frontend after changes to `next.config.ts`

### 2. CORS-like errors in browser

- This frontend uses rewrite proxy, so calls should go to `/api/...`
- Confirm `src/lib/api.ts` uses `baseURL: '/'`

### 3. Styles/settings not updating

- Hard refresh browser
- Check console for errors
- Confirm localStorage key `docuease-settings` exists

## Team Workflow Notes

- Keep frontend-only changes inside `frontend/`
- If API contract changes, update:
  - `frontend/src/lib/api.ts`
  - relevant page hooks/components
  - docs in `APP_PAGES_AND_API.md`
