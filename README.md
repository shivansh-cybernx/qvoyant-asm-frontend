# @qvoyant/asm — ASM Module Federation remote

React + Vite remote for QVoyant ASM. Loaded by the host shell (`@qvoyant/host`) via Module Federation.

```text
Host shell (:5173)
  → /dashboard/nxhawk/asm/*
  → lazy import('asmApp/AsmApp')
  → http://localhost:5174/remoteEntry.js
       ↓ credentials: include
Node API (qvoyant-asm-backend :4000)
```

## MF contract

| Item | Value |
|------|--------|
| Federation name | `asmApp` |
| Expose | `./AsmApp` → host import `asmApp/AsmApp` |
| Dev port | `5174` |
| Host env | `VITE_REMOTE_ASM=http://localhost:5174/remoteEntry.js` |
| Shared | `react`, `react-dom`, `react-router-dom` (singleton) |

Opening `http://localhost:5174/` shows a remote landing page. Product UI runs inside the host.

## Setup

```bash
cd qvoyant-asm-frontend
cp .env.example .env
pnpm install
pnpm dev
```

## Dev with host

```bash
# T1 — ASM API
cd ../qvoyant-asm-backend && pnpm dev   # :4000

# T2 — ASM remote
cd ../qvoyant-asm-frontend && pnpm dev  # :5174 → remoteEntry.js

# T3 — host shell
cd ../qvoyant-frontend-host
# ensure .env.local has:
#   VITE_REMOTE_ASM=http://localhost:5174/remoteEntry.js
pnpm install && pnpm dev               # :5173
```

Open: http://localhost:5173/dashboard/nxhawk/asm

## Backend

```bash
cd ../qvoyant-asm-backend
pnpm dev   # http://localhost:4000
```

CORS must allow the host origin (and optionally the remote for standalone checks):

```bash
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:4000
```

`.env`:

```bash
VITE_API_BASE_URL=http://localhost:4000/api/v1
VITE_APP_PORT=5174
```

## Features (current remote UI)

1. List organizations
2. Seed target domains + related assets
3. Ownership verify (`DEMO_SKIP` / `DNS_TXT` / `WEB_ROOT`)
4. Discovery panel

Seed user: `admin@qvoyant.com` / `Admin@12345`

## Folder structure

```text
src/
  main.jsx          # remote landing (standalone :5174)
  AsmApp.jsx        # MF expose — relative routes for host
  App.jsx           # product shell
  api.js
  styles.css
  components/
```

## Related

- Host registry: `qvoyant-frontend-host/src/remotes/remoteRegistry.js`
- Remote contract: `qvoyant-frontend-host/src/docs/REMOTE_DEVELOPER_CONTRACT.md`
# qvoyant-asm-frontend
