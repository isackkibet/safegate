# SafeGate

> **Every delivery, verified.** A decentralized, identity-verified delivery authorization system that stops Cash-on-Delivery (COD) fraud.

SafeGate proves **who** a rider is, **what** they are allowed to do, and **when** an action was authorized — before any package moves or cash changes hands. It combines W3C-standard **Decentralized Identifiers (DIDs)** and **Verifiable Credentials (VCs)** with a deterministic **authorization Guardian**, so no fake rider can ever collect cash or release a package.

## The Problem

Delivery fraud is expensive and hard to control:

- Anyone can impersonate a delivery rider — especially for **COD**, where real money exchanges hands.
- Riders are verified with static, copyable credentials (badges, phone numbers) that are easy to fake.
- Authorizations happen informally with **no auditable proof** of *who* was approved and *why*.
- No fine-grained control: a rider may deliver packages but should *never* be allowed to collect cash.
- Disputes have **no tamper-proof record** of what was authorized.

## The Solution

| The problem | SafeGate |
|---|---|
| Anyone can fake being a rider | **DIDs** — unforgeable decentralized identity |
| Static, copyable credentials | **Verifiable Credentials** with Ed25519 cryptographic signatures |
| No fine-grained control | **Permission-based credentials** with amount limits |
| Slow, manual approvals | **Automated Guardian** makes instant, consistent decisions |
| No proof in disputes | **Immutable audit trail** for every decision |

## How It Works

```
 Rider sends free-text request
        │    e.g. "Collect KES 1,500 COD for order #ord_123"
        ▼
 🤖 AI Agent            — extracts a structured request
        │                (which order? what action? how much cash?)
        ▼
 🛡️ Guardian            — verifies identity & credentials
        │  + runs 6 independent security checks
        ▼
 📦 Backend             — executes the approved action +
        ▼                writes a tamper-proof audit trail
 🧾 Audit Log           — every approval & denial, recorded & streamed live
```

### The 6 Guardian Checks

Before **any** action is approved, the Guardian independently verifies **all six**:

| # | Check | Ensures |
|---|-------|---------|
| 1 | `orderExists` | The order is real |
| 2 | `riderDidResolves` | The rider's DID resolves to a valid identity |
| 3 | `vcSignatureValid` | The credential isn't a forgery |
| 4 | `riderAssignedToOrder` | This rider is the one assigned to this order |
| 5 | `permissionIncludesAction` | The rider is legally allowed to perform this action |
| 6 | `amountWithinLimit` | COD amount is within the rider's authority |

✅ **Only if every check passes → APPROVED.** Otherwise → **DENIED**, with a reason.

### Fine-Grained Permissions

A credential isn't just "this rider is verified" — it defines exactly what the rider may do:

| Action | Meaning |
|--------|---------|
| `RELEASE_PACKAGE` | Hand over the package |
| `COLLECT_COD` | Collect cash on delivery |
| `COLLECT_AND_RELEASE` | Both — collect cash AND release the package |

Each credential also carries a `maxAmount` spending ceiling. A courier can deliver 100 packages, but only collect COD up to their configured limit — nothing more.

## Architecture — A Monorepo

SafeGate is a TypeScript monorepo with cleanly separated services, each owning one bounded responsibility:

```
safegate/
├── packages/
│   ├── shared-types/     # Canonical cross-service TS contracts (StructuredRequest, GuardianDecision)
│   └── shared-crypto/    # Single source of truth for Ed25519 / did:key / VC signing & verification
├── ai-agent/             # 🤖 Natural language → structured request extraction (Gemini + offline fallback)
├── guardian/             # 🛡️ The deterministic authorization engine (the ONLY authority)
├── backend/              # 🗄️ Express REST API + Prisma registry (orders, riders, VCs, audit, SSE)
├── frontend/             # 🖥️ Next.js dashboard (orders, riders, credentials, audit, live feed)
└── contracts/            # 🔗 Solidity: on-chain audit anchoring + credential revocation registry
```

**Defense in depth:** the AI Agent *pre-checks* identity and *extracts* intent, but it **never authorizes anything** — the Guardian's cryptographic decision is the sole authority. LLM output is never trusted for permissions; the system prompt and tests guard explicitly against prompt injection.

| Service | Port | Role |
|---------|------|------|
| `ai-agent` | 3003 | Extracts structured requests from free text |
| `guardian` | 3001 | Runs the 6 checks, makes the decision |
| `backend` | 3002 | REST API, credential issuance, registry, SSE events |
| `frontend` | 3000 | Next.js dashboard |

## Quick Start

**Prerequisites:** Node.js 18+, npm.

```bash
# 1. Install all workspace dependencies
npm install

# 2. Set up the database
npm run db:push -w @safegate/backend

# 3. (Optional) seed demo data — riders, orders, credentials
node seed.mjs

# 4. Start every service (guardian, backend, frontend, ai-agent)
npm run dev
```

Then open **http://localhost:3000** for the dashboard.

> ✅ The whole demo works **without any external API keys** — the AI agent falls back to a deterministic local parser when `GEMINI_API_KEY` is not set.

### Run Individual Services

```bash
npm run dev:guardian   # 🛡️ authorization engine
npm run dev:backend    # 🗄️ REST API + database
npm run dev:frontend   # 🖥️ dashboard
npm run dev:agent      # 🤖 AI agent HTTP server
```

> The AI agent also ships an interactive CLI (`npm run dev -w @safegate/ai-agent`).

### Environment Configuration

Copy the relevant `.env.example` into each package (or set the root-level variables). Key variables:

| Variable | Service | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | ai-agent | Google Gemini key (optional — offline fallback otherwise) |
| `DISPATCHER_API_KEY` | backend | Protects dispatcher write endpoints (`X-API-Key`) |
| `PLATFORM_PRIVATE_KEY` | backend | Hex Ed25519 private key used to issue VCs (auto-generated if blank) |
| `DATABASE_URL` | backend | Prisma/SQLite connection string |
| `NEXT_PUBLIC_BACKEND_URL` | frontend | Backend base URL |

## Testing

```bash
# Run all workspace tests
npm test

# Or test a single service
npm test -w @safegate/guardian
npm test -w @safegate/backend
npm test -w @safegate/ai-agent
```

- **Guardian** — 6 decision scenarios (valid, over-limit, revoked, tampered, expired, unassigned).
- **Backend** — proxy contract + issued-VC cryptographic verification.
- **AI Agent** — extraction, identity pre-check, offline parser edge cases, and prompt-injection resistance.
- **Contracts** — on-chain anchor/revoke authorization and double-revoke/double-anchor rejection.

## Security Model

- **Unforgeable identity** — riders are `did:key` (Ed25519) DIDs.
- **Cryptographically signed permissions** — W3C JSON-LD VCs signed with `Ed25519Signature2020`.
- **A single authority** — the Guardian is deterministic and LLM-independent; the AI layer only extracts intent.
- **Prompt-injection resistance** — extraction output is validated, never used to authorize.
- **Append-only audit** — every decision is written to a JSONL log and streamed via SSE to dashboards, and can be anchored on-chain.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | npm workspaces, TypeScript (strict) |
| **Backend** | Node.js, Express, Prisma, SQLite |
| **Guardian** | TypeScript, `did-resolver`, Ed25519 via `node:crypto` |
| **AI Agent** | `@google/generative-ai` + deterministic local parser |
| **Frontend** | Next.js 14 (App Router), React 18, Server-Sent Events |
| **Contracts** | Hardhat 3, Solidity, OpenZeppelin, ethers v6, Mocha |

## Roadmap

- 🆔 **StatusList2021** — revocation lists that scale (current MVP uses simple ACTIVE/REVOKED status).
- 🌐 **Fully decentralized DID resolution** — move off centralized lookup.
- 📱 **Mobile rider app** — manage credentials & approvals on the go.
- 🔗 **Cross-platform identity** — one DID across many logistics networks.

---

### SafeGate — *Every delivery, verified.*
