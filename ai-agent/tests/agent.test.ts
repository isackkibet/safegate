import { describe, it, expect } from 'vitest';
import { Agent } from '../src/agent/agent.js';
import { MockLLMClient } from '../src/agent/llm.js';
import { LocalGuardianClient } from '../src/guardian/client.js';
import { InProcessExecutionTools } from '../src/tools/tools.js';

const RIDER_ACTIVE = 'did:key:z6Mkrider88';
const RIDER_REVOKED = 'did:key:z6Mkrider12';

function makeAgent() {
  const guardian = new LocalGuardianClient({
    registry: { [RIDER_ACTIVE]: 'ACTIVE', [RIDER_REVOKED]: 'REVOKED' },
    orderAssignments: { '4521': RIDER_ACTIVE, '4521b': RIDER_REVOKED },
    orderAmounts: { '4521': 1500, '4521b': 1500 },
    maxByRider: { [RIDER_ACTIVE]: 5000, [RIDER_REVOKED]: 5000 },
  });
  const agent = new Agent({
    llm: new MockLLMClient(),
    guardian,
    tools: new InProcessExecutionTools(),
  });
  return agent;
}

describe('SafeGate Agent — valid flow', () => {
  it('approves a valid collect request', async () => {
    const agent = makeAgent();
    const result = await agent.run(
      `I'm here to deliver order #4521, collecting KSh 1,500 COD. ${RIDER_ACTIVE}`,
      { riderDid: RIDER_ACTIVE },
    );
    expect(result.allowed).toBe(true);
    expect(result.request).toMatchObject({
      orderId: '4521',
      amount: 1500,
      currency: 'KES',
      action: 'COLLECT_COD',
    });
  });

  it('denies when the amount exceeds the rider limit', async () => {
    const agent = makeAgent();
    const result = await agent.run(
      `Collecting KSh 50,000 COD for order #4521. ${RIDER_ACTIVE}`,
      { riderDid: RIDER_ACTIVE },
    );
    expect(result.allowed).toBe(false);
    expect(result.response?.reason).toBe('AMOUNT_EXCEEDS_LIMIT');
  });
});
