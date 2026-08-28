# SafeGate — AI Agent

The **AI Agent** is the entry point that turns a rider's natural-language message
into a structured authorization request, then hands control to the deterministic
**SafeGate Guardian** before any package is released or payment collected.

This package implements the **AI Agent Engineer** responsibilities:

- LLM integration (message understanding + intent extraction)
- Message parsing (order ID, rider DID, amount, action)
- Request formatting for the Guardian
- DID / Verifiable Credential verification (`did-jwt-vc`)
- Prompt-injection test cases
- Decision (audit) logging

## Core safety principle

> The LLM never releases a package or triggers a payment directly. It only
> converts natural language into a structured request. A deterministic Guardian
> makes the actual decision.

The Agent orchestrates this pipeline:

```
message ──LLM──▶ extraction ──normalize──▶ GuardianRequest ──Guardian──▶ allowed?
                                                                          │
                                                     APPROVED ──▶ tools (release/collect)
                                                     DENIED   ──▶ tools (deny/alert)
                                                                          │
                                                                        audit log
```

Injection is contained at **two independent layers**:

1. **Extraction normalization** rejects flagged / ambiguous / instruction-override
   LLM output (see `src/agent/extractor.ts`).
2. The **Guardian** re-checks numeric limits from the signed VC, so even a fooled
   LLM cannot move money/package outside the signed permission.

## Directory layout

```
src/
  agent/
    llm.ts        LLM client (OpenAI-compatible + deterministic mock fallback)
    extractor.ts  normalize LLM output into a validated GuardianRequest
    agent.ts      orchestrates extract → verify → Guardian → tools → log
  did/
    verifier.ts   DID resolution + VC signature verification (did-jwt-vc)
  guardian/
    client.ts     Guardian client (HTTP or local deterministic mirror)
  tools/
    tools.ts      release / collect-payment / deny / alert execution boundary
  logging/
    audit.ts      in-memory decision log (snapshot of request+response+extraction)
  routes/
    agent.ts      Express HTTP API
  index.ts        server bootstrap
tests/
  agent.test.ts     valid-flow + amount-limit tests
  injection.test.ts prompt-injection + revoked-credential tests
  identity.test.ts  cryptographic DID/VC round-trip & tamper rejection
```

## Running

```bash
npm install
npm run dev        # starts server on :4100 (HTTP API)
npm test           # 12 tests: pipeline + injection + crypto identity
npm run build
```

## HTTP API

- `POST /agent/process` — body `{ "message": string, "riderDid": string? }`

  ```bash
  curl -X POST :4100/agent/process -H 'Content-Type: application/json' \
    -d '{"message":"I'm here to deliver order #4521, collecting KSh 1,500 COD","riderDid":"did:key:z6Mkrider88"}'
  ```

- `GET /agent/decisions` — recent audit log
- `GET /agent/decisions/:id` — single decision
- `GET /agent/health`

## Environment

See `.env.example`:

| Key | Purpose |
| --- | --- |
| `LLM_API_KEY` | real LLM (unset → deterministic mock) |
| `SAFEGATE_BACKEND_URL` | backend Guardian + tools base URL |
| `SAFEGATE_BACKEND_TOKEN` | optional bearer token for backend calls |

## Identity layer

Riders and the platform get `did:key` DIDs (no chain needed). The platform signs
a `RiderAuthorizationCredential` (Ed25519) granting the rider permissions and a
`maxCollectionAmount`. The Agent verifies the signature via `did-jwt-vc` +
`key-did-resolver` (see `tests/identity.test.ts` for a working round-trip).

Remaining backend-owned pieces (handled by the Backend engineer):

- **Guardian HTTP API** (`/guardian/authorize`) — order existence, assignment,
  VC status (revocation list), permission + amount limit, anti-brute-force.
- **Execution tools** (`/tools/release`, `/tools/collect-payment`, `/tools/deny`,
  `/tools/alert`).
- Persistent **audit store** (PostgreSQL) with optional Avalanche hash anchoring.

For a self-contained demo the Agent ships a `LocalGuardianClient` that mirrors
these checks; point `SAFEGATE_BACKEND_URL` at the real backend to switch to it.
