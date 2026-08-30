# SafeGate

SafeGate is a decentralized, identity-verified delivery authorization system. It stops Cash-on-Delivery (COD) fraud by proving who a rider is, what they are allowed to do, and when an action was authorized, all before any package moves or cash changes hands.

SafeGate combines W3C-standard **Decentralized Identifiers (DIDs)** and **Verifiable Credentials (VCs)** with a deterministic **Guardian** that checks every request. The result is that no fake rider can ever collect cash or release a package.

## The Problem

Delivery fraud is expensive and hard to control:

- Anyone can impersonate a delivery rider, especially for COD, where real money changes hands.
- Riders are verified with static, copyable credentials (badges, phone numbers) that are easy to fake.
- Authorizations happen informally, with no auditable proof of who was approved and why.
- There is no fine-grained control. A rider may deliver packages, but should never be allowed to collect cash.
- Disputes have no tamper-proof record of what was authorized.

## The Solution

| The problem | SafeGate |
|---|---|
| Anyone can fake being a rider | DIDs, an unforgeable decentralized identity |
| Static, copyable credentials | Verifiable Credentials with Ed25519 cryptographic signatures |
| No fine-grained control | Permission-based credentials with amount limits |
| Slow, manual approvals | An automated Guardian that makes instant, consistent decisions |
| No proof in disputes | An immutable audit trail for every decision |

## How It Works

A rider sends a free-text request, for example "Collect KES 1,500 COD for order #ord_123". The system then works through four steps:

1. **AI Agent** extracts a structured request, determining which order, what action, and how much cash.
2. **Guardian** verifies the identity and credentials, running 6 independent security checks.
3. **Backend** executes the approved action and writes a tamper-proof audit trail.
4. **Audit Log** records every approval and denial, streamed live to dashboards.

### The 6 Guardian Checks

Before any action is approved, the Guardian independently verifies all six:

| # | Check | Ensures |
|---|-------|---------|
| 1 | `orderExists` | The order is real |
| 2 | `riderDidResolves` | The rider's DID resolves to a valid identity |
| 3 | `vcSignatureValid` | The credential is not a forgery |
| 4 | `riderAssignedToOrder` | This rider is the one assigned to this order |
| 5 | `permissionIncludesAction` | The rider is legally allowed to perform this action |
| 6 | `amountWithinLimit` | The COD amount is within the rider's authority |

Only if every check passes is the request **APPROVED**. Otherwise it is **DENIED**, with a reason given.

### Fine-Grained Permissions

A credential is more than a simple "this rider is verified". It defines exactly what the rider may do:

| Action | Meaning |
|--------|---------|
| `RELEASE_PACKAGE` | Hand over the package |
| `COLLECT_COD` | Collect cash on delivery |
| `COLLECT_AND_RELEASE` | Both collect cash and release the package |

Each credential also carries a `maxAmount` spending ceiling. A courier can deliver 100 packages, but can only collect COD up to their configured limit, and nothing more.

## Architecture, a Monorepo

SafeGate is a TypeScript monorepo with cleanly separated services, each owning one bounded responsibility:

```
safegate/
├── packages/
│   ├── shared-types/     # Canonical cross-service TS contracts (StructuredRequest, GuardianDecision)
│   └── shared-crypto/    # Single source of truth for Ed25519 / did:key / VC signing and verification
├── ai-agent/             # Natural language to structured request extraction (Gemini + offline fallback)
├── guardian/             # The deterministic authorization engine (the only authority)
├── backend/              # Express REST API + Prisma registry (orders, riders, VCs, audit, SSE)
├── frontend/             # Next.js dashboard (orders, riders, credentials, audit, live feed)
└── contracts/            # Solidity layer for on-chain audit anchoring and credential revocation
```

Defense in depth is built in. The AI Agent pre-checks identity and extracts intent, but it never authorizes anything. The Guardian's cryptographic decision is the sole authority. LLM output is never trusted for permissions; the system prompt and tests guard explicitly against prompt injection.

| Service | Port | Role |
|---------|------|------|
| `ai-agent` | 3003 | Extracts structured requests from free text |
| `guardian` | 3001 | Runs the 6 checks and makes the decision |
| `backend` | 3002 | REST API, credential issuance, registry, SSE events |
| `frontend` | 3000 | Next.js dashboard |

## Quick Start

**Prerequisites:** Node.js 18+ and npm.

```bash
# 1. Install all workspace dependencies
npm install

# 2. Set up the database
npm run db:push -w @safegate/backend

# 3. (Optional) seed demo data, riders, orders, credentials
node seed.mjs

# 4. Start every service (guardian, backend, frontend, ai-agent)
npm run dev
```

Then open **http://localhost:3000** for the dashboard.

The whole demo works **without any external API keys**. The AI agent falls back to a deterministic local parser when `GEMINI_API_KEY` is not set.

### Run Individual Services

```bash
npm run dev:guardian   # authorization engine
npm run dev:backend    # REST API + database
npm run dev:frontend   # dashboard
npm run dev:agent      # AI agent HTTP server
```

The AI agent also ships an interactive CLI, run with `npm run dev -w @safegate/ai-agent`.

### Environment Configuration

Copy the relevant `.env.example` into each package, or set the root-level variables. Key variables:

| Variable | Service | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | ai-agent | Google Gemini key (optional, offline fallback otherwise) |
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

- **Guardian** covers 6 decision scenarios: valid, over-limit, revoked, tampered, expired, and unassigned.
- **Backend** covers the proxy contract and issued-VC cryptographic verification.
- **AI Agent** covers extraction, identity pre-check, offline parser edge cases, and prompt-injection resistance.
- **Contracts** covers on-chain anchor and revoke authorization, plus double-revoke and double-anchor rejection.

## Security Model

- **Unforgeable identity.** Riders use `did:key` (Ed25519) DIDs.
- **Cryptographically signed permissions.** W3C JSON-LD VCs are signed with `Ed25519Signature2020`.
- **A single authority.** The Guardian is deterministic and independent of the LLM; the AI layer only extracts intent.
- **Prompt-injection resistance.** Extraction output is validated and never used to authorize.
- **Append-only audit.** Every decision is written to a JSONL log, streamed via SSE to dashboards, and can be anchored on-chain.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | npm workspaces, TypeScript (strict) |
| **Backend** | Node.js, Express, Prisma, SQLite |
| **Guardian** | TypeScript, `did-resolver`, Ed25519 via `node:crypto` |
| **AI Agent** | `@google/generative-ai` plus a deterministic local parser |
| **Frontend** | Next.js 14 (App Router), React 18, Server-Sent Events |
| **Contracts** | Hardhat 3, Solidity, OpenZeppelin, ethers v6, Mocha |

## Roadmap

- **StatusList2021.** Revocation lists that scale (the current MVP uses simple ACTIVE/REVOKED status).
- **Fully decentralized DID resolution.** Move off centralized lookup.
- **Mobile rider app.** Manage credentials and approvals on the go.
- **Cross-platform identity.** One DID across many logistics networks.

---

### SafeGate. Every delivery, verified.
