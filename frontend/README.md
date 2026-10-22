# Elekeza Frontend

Web client for the Elekeza adaptive learning platform: learners, teachers, guardians and school
administrators. Built with Next.js (App Router), React 19, TypeScript, Tailwind CSS and TanStack Query.

New to the code? Read **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — it explains the folder layout
and how to add a page, a feature or an API call. **[docs/FEATURES.md](docs/FEATURES.md)** lists what
each role can do and where it lives; **[docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md)** is the backlog
of known limitations and ideas; **[docs/BACKEND_REQUESTS.md](docs/BACKEND_REQUESTS.md)** lists what the
backend needs to change or add.

## Prerequisites

- Node.js `20.19+` or `22.12+`, npm `10+`
- The backend running (default `http://localhost:8085`)

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

The browser only ever calls same-origin `/api/...`; `next.config.ts` proxies it to the backend.
Point it at another backend with `NEXT_PUBLIC_API_URL` (required for production builds):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8085 npm run dev
```

The backend only accepts the origins listed in its CORS settings (dev profile: ports `3000`, `3001`,
`3100`, `3005`). If sign-in fails with *Invalid CORS request*, run the frontend on one of those ports
(`npm run dev -- -p 3005`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint (must pass with no errors) |
| `npm run type-check` | TypeScript, no emit |
| `npm run format` / `format:check` | Prettier write / check (`src/`) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; builds and boots its own backend) |

Before opening a pull request: `npm run lint && npm run type-check && npm test && npm run format:check`.

## Project layout (short version)

```
src/
  app/            Routing only. (public)/ = no session needed, (app)/ = signed-in shell.
  features/       One folder per domain: api.ts, screens/, components/.
  components/     Shared, domain-free UI: ui/ (kit) and layout/ (app shell).
  config/         Navigation menus and route constants.
  lib/            HTTP client, roles, formatting and other helpers.
  hooks/          Generic React hooks.
  providers/      App-wide providers (query client, auth, accessibility).
  styles/         Design tokens and theme remaps.
```

## Seed accounts (dev profile)

| Role | Email | Password |
| --- | --- | --- |
| Learner | `student@elekeza.app` | `student123` |
| Teacher | `teacher@elekeza.app` | `teacher123` |
| Guardian | `parent@elekeza.app` | `parent123` |
| Platform admin (also manages the seeded school) | `admin@elekeza.app` | `admin123` |

## Troubleshooting

- **Sign-in fails / 403 on every write** — check the backend is up and the frontend port is in its CORS
  list (see above). Calls must go through `/api` (never an absolute backend URL in the browser), or the
  CSRF cookie will not reach the API.
- **Type-check fails on `.next/dev/types`** after pulling structural changes — delete `.next/` (it is a
  local build cache) and run `npm run dev` once.
- **Theme or settings look stale** — they live in the browser's `localStorage` key `elekeza-settings`.
