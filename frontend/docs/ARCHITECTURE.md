# Frontend architecture

How the Elekeza frontend is organised, the rules that keep it modular, and step-by-step recipes for
the most common changes.

## 1. The big picture

```
app/ (routes)  ──renders──▶  features/<domain>/screens  ──use──▶  features/<domain>/api.ts ──▶ lib/api (HTTP client) ──▶ /api (Next proxy) ──▶ backend
                                     │
                                     └──use──▶  components/ui (kit), components/layout, config/, lib/, hooks/
```

- **`src/app/` is routing only.** Every `page.tsx` is a few lines: it sets the browser tab title and
  renders one screen from a feature. No data fetching, no markup.
- **`src/features/<domain>/` owns a domain** — its API calls, types, screens and components.
- **Shared code is domain-free.** `components/ui` never imports from `features/`.

### Route groups

| Folder | Who | Layout |
| --- | --- | --- |
| `app/(public)/` | anyone (login, register, password reset, school sign-up, waitlist) | none — screens render their own centered card |
| `app/(app)/` | signed-in users | `AppShell`: sidebar, mobile nav, notifications, Elekeza Assist, and a session guard that sends visitors to `/login` |

Route groups don't change URLs: `app/(app)/teacher/students/page.tsx` serves `/teacher/students`.

## 2. Folder guide

```
src/
├─ app/
│  ├─ (public)/…/page.tsx        thin route files
│  ├─ (app)/layout.tsx           wraps every signed-in page in AppShell
│  ├─ (app)/…/page.tsx           thin route files
│  ├─ layout.tsx                 html/body, providers, pre-paint theme script
│  ├─ not-found.tsx, page.tsx    404 and the "/" role redirect
│  └─ globals.css
├─ features/
│  └─ <domain>/
│     ├─ api.ts                  typed API calls + query keys (+ shared query hooks)
│     ├─ screens/XScreen.tsx     one per page; default export
│     ├─ components/             pieces used by this domain's screens
│     └─ index.ts                (optional) public API for OTHER features
├─ components/
│  ├─ ui/                        Button, Card, Field/TextInput/Select/Textarea, Alert, Badge,
│  │                             Switch, Tabs, PageHeader, LoadingState, EmptyState, Toast, ComingSoon
│  └─ layout/                    AppShell, SidebarNav, MobileBottomNav, ElekezaAssist
├─ config/
│  ├─ navigation.ts              every role's menu (sidebar + mobile bottom bar)
│  └─ routes.ts                  public paths and URL builders
├─ lib/
│  ├─ api/                       apiClient (CSRF + session refresh), error helpers
│  ├─ roles.ts                   role → home page / label
│  ├─ format.ts, download.ts, phone.ts, pluralize.ts, cn.ts, storageKeys.ts
├─ hooks/                        generic hooks (e.g. useOnlineStatus)
├─ providers/AppProviders.tsx    QueryClient, Auth, Accessibility settings
└─ styles/                       tokens.css (design tokens + themes), theme-remaps.css
```

Current features: `accessibility`, `account`, `admin`, `assignments` (classwork), `attendance`, `auth`,
`calendar`, `classes`, `curriculum`, `devices`, `exams`, `finance`, `guardian`, `learner`, `learners`
(school-wide learner records), `lessons`, `messaging`, `notifications`, `quiz`, `teacher`, `tutor`,
`waitlist`.

What each role can do, page by page: **[FEATURES.md](FEATURES.md)**. Ideas and known limitations:
**[IMPROVEMENTS.md](IMPROVEMENTS.md)**.

## 3. Dependency rules

1. Route files (`page.tsx`) import a screen from `features/` (or `ComingSoon` from `components/ui`) and
   nothing else. Only the root files (`layout.tsx`, `page.tsx`, `not-found.tsx`) touch providers and helpers.
2. A feature may import `components/`, `config/`, `lib/`, `hooks/`, and **another feature's
   `api.ts` or `index.ts`** (e.g. `lessons` uses `useStudents` from `features/teacher/api`). Never
   reach into another feature's `screens/` or `components/` internals.
3. `components/ui` and `lib/` never import from `features/`.
4. Screens never build URLs or call `apiClient` directly — they call their feature's `api.ts`.
5. Pages import screens by path (`@/features/x/screens/YScreen`), not through a barrel, so each route
   only bundles what it needs.

## 4. Data: API calls and TanStack Query

Each feature's `api.ts` follows the same shape:

```ts
// features/attendance/api.ts
export const attendanceApi = {
  classes: () => apiClient.get<ClassInfo[]>('/attendance/classes').then((r) => r.data),
  save: (classId: number, date: string, records: AttendanceEntry[]) =>
    apiClient.post<AttendanceSessionInfo>(`/attendance/classes/${classId}/sessions`, { records }, { params: { date } })
      .then((r) => r.data),
};

export const attendanceKeys = {
  classes: ['attendance', 'classes'] as const,
  roster: (classId: number, date: string) => ['attendance', 'roster', classId, date] as const,
};

export function useClasses() {               // shared hooks live here too
  return useQuery({ queryKey: attendanceKeys.classes, queryFn: attendanceApi.classes });
}
```

Conventions:

- API functions **return data**, not Axios responses, and carry explicit types for the response.
- Reads: `useQuery` with a key from the feature's `…Keys` object. Pass `enabled` when an id may be
  missing.
- Writes: `useMutation`; on success either update the cache (`setQueryData`) or
  `invalidateQueries` with the affected key. Never re-fetch by hand.
- Errors: `getErrorMessage(err, 'Friendly fallback')` shows the server's message when it sent one;
  `getErrorStatus(err)` for status-specific copy (403, 409…).
- Global defaults (`providers/AppProviders.tsx`): 30 s stale time, no refetch on window focus, one
  retry for network/5xx errors and none for 4xx.
- Selection state that depends on loaded data is *derived*, not synced with an effect:
  `const classId = chosenClassId ?? classes[0]?.id ?? null`.

### Auth and session (`lib/api/client.ts`)

- Same-origin `/api` only; the Next.js rewrite forwards to the backend, so cookies stay first-party.
- A fresh CSRF token is fetched before every non-GET request (Spring's token is single-use).
- On 401 (or 403 `AUTH_REQUIRED`) the client refreshes the session once (single-flight) and retries;
  if that fails it sends the user to `/login`, except on public pages and for the initial `/auth/me`.
- `useAuth()` (`features/auth`) exposes `user`, `loading`, `login`, `register`, `logout`. Logging in or
  out clears the query cache so no data leaks between users.

## 5. UI conventions

- Build screens from the kit in `components/ui`. Use `PageHeader` for the page's single `<h1>`.
- Forms: wrap every control in `<Field id label>` (it wires the label, hint and error). Inputs use the
  kit's `TextInput` / `Select` / `Textarea`. Passing a width or padding class (`w-48`, `py-1.5`)
  replaces the default one — `cn` itself does not merge conflicting Tailwind classes.
- Sections within a page: `<Tabs>` (keyboard arrows, proper tab/tabpanel roles).
- Side-by-side cards in a grid: add `items-start` so a short card doesn't stretch to its neighbour's height.
- Status messages: `<Alert tone="success|error|info|warning">` — errors use `role="alert"`,
  the rest `role="status"`. Loading: `<LoadingState>`. Nothing yet: `<EmptyState>`.
- Colours: prefer the semantic Tailwind names, which follow the active theme —
  `bg-surface`, `text-fg`, `text-fg-muted`, `border-line`, `bg-accent`, `text-danger`, … (see
  `tailwind.config.ts`). Older screens still use `text-purple-*` classes; `styles/theme-remaps.css`
  maps those onto tokens, so they theme correctly too.
- Never convey meaning by colour alone (pair it with text or an icon); keep visible text inside
  accessible names; give icon-only buttons an `aria-label`.
- Planned features use `<ComingSoon>` — no fake data or controls that do nothing.

### Themes and accessibility settings

`features/accessibility/AccessibilitySettingsProvider` is the single source of truth for the
learner's local display settings (stored in `localStorage` key `elekeza-settings`). It applies the
theme (`data-theme` = `dark` | `light` | `calm` on `<html>`) and the `a11y-*` body classes styled in
`globals.css`. A small script in `app/layout.tsx` applies the saved theme before first paint.

## 6. Recipes

### Add a page to an existing feature

1. Create `src/features/<domain>/screens/NewThingScreen.tsx` (`'use client'`, default export).
2. Create the route file:

   ```tsx
   // src/app/(app)/teacher/new-thing/page.tsx
   import type { Metadata } from 'next';
   import NewThingScreen from '@/features/teacher/screens/NewThingScreen';

   export const metadata: Metadata = { title: 'New thing' }; // tab shows "New thing · Elekeza"

   export default function Page() {
     return <NewThingScreen />;
   }
   ```

3. If it belongs in a menu, add one line to `src/config/navigation.ts`.

### Call a new backend endpoint

1. Add the response type and a function to the feature's `api.ts` (and a key to its `…Keys`).
2. Use it from the screen with `useQuery` / `useMutation`.

### Add a new feature (domain)

1. `src/features/<domain>/api.ts`, `screens/`, `components/` as needed.
2. Route files under `app/(app)/` (or `app/(public)/` if no sign-in is needed — also add the path to
   `PUBLIC_PATHS` in `config/routes.ts`).
3. Menu entries in `config/navigation.ts`.
4. If other features need something from it, export it from `features/<domain>/index.ts`.

### Add a role

Add it to `Role` and the maps in `lib/roles.ts`, then give it a menu in `NAV_BY_ROLE`
(`config/navigation.ts`). TypeScript will point at anything else that needs a value.

## 7. Testing

- **Unit** (`npm test`, Vitest + Testing Library): files named `*.test.ts(x)` next to the code.
- **End-to-end** (`npm run test:e2e`, Playwright): `e2e/` — journeys, accessibility (axe, WCAG 2.1 AA),
  a route crawl, offline quiz, attendance/finance, exams. The suite builds and boots the backend itself.
- E2E tests select elements by role and visible text (e.g. the `Login` button, the `Save register`
  button, placeholder `Enter your email`). If you rename a visible label, update the matching spec.

## 8. Known gaps and upgrade path

- **Tailwind v4**: the code targets Tailwind v3. Migrating means switching PostCSS to
  `@tailwindcss/postcss`, replacing the `@tailwind` directives with `@import "tailwindcss"`, and moving
  the theme extension in `tailwind.config.ts` into CSS — then a visual check of every screen.
- **Design tokens**: `styles/tokens.css` contains unused role palettes (`blue`, `purple`, `green`
  themes are never applied) and combined selectors that can never match; `theme-remaps.css` exists
  only for legacy `purple-*` classes. As screens move to semantic colour names, both can shrink.
- **Backend contract gaps found during the review** (frontend works around them):
  - `POST /api/content/upload/file` ignores a lesson title — file lessons are titled with the file
    name.
  - `GET /api/teacher/students` returns ids as strings; `teacherApi.students` converts them to numbers.
  - Guardians have no institution, so the calendar only shows them national/regional dates.
  - Public registration has no role field, by design; the sign-up page now says so.
  - More in [IMPROVEMENTS.md](IMPROVEMENTS.md) §1.
- **Internationalisation**: copy is English-only and inline. Kiswahili support would start with a
  message catalogue per feature.
