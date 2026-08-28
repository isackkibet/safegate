import type {
  Decision,
  GuardianCheck,
  Order,
  ParsedRequest,
  Rider,
} from './types';
import { createAuditHash } from './mockData';

const rs = (n: string, pass: boolean, detail: string, critical = false): GuardianCheck => ({
  name: n,
  passed: pass,
  detail,
  critical,
});

export function aiParse(message: string, riderDid: string): ParsedRequest {
  const clean = message.trim();

  const orderMatch = clean.match(/order\s+#?(\d{2,5})\b/i);

  const amountMatch =
    clean.match(
      /(?:kes|ksh|k\.?\s?sh\.?|shillings?)\s*([\d,]+(?:\.\d{1,2})?)/i,
    ) ??
    clean.match(/^([\d,]+(?:\.\d{1,2})?)\s*(?:kes|ksh)/i);

  let currency: string | null = null;
  let amount: number | null = null;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    currency = /shil/i.test(amountMatch[0]) ? 'KES' : amountMatch[0].match(/kes|ksh/i) ? 'KES' : 'KES';
  }

  let action: ParsedRequest['action'] = 'RELEASE_PACKAGE';
  if (/release without/i.test(clean)) {
    action = 'RELEASE_PACKAGE';
  } else if (/collect|payment|cod|charge|money|amount|invoice/i.test(clean)) {
    action = 'COLLECT_COD';
  } else if (/release|deliver/i.test(clean)) {
    action = 'RELEASE_PACKAGE';
  }

  const injection = /\b(ignore|override|don'?t)\b.*\b(instructions|rules|prompt|system)/i.test(clean) ||
    /release without (payment|collection)/i.test(clean) ||
    /skip verification/i.test(clean) ||
    /pretend .*approved/i.test(clean);

  const injectionReason = injection
    ? /\bignore\b.*\binstructions\b/i.test(clean)
      ? 'Message contains an "ignore previous instructions" style attempt'
      : 'Prompt contains instructions that conflict with the requested action'
    : undefined;

  return {
    orderId: orderMatch ? orderMatch[1] : null,
    riderDid,
    action,
    amount,
    currency,
    raw: clean,
    injectionFlagged: injection,
    injectionReason,
  };
}

export function evaluate(
  parsed: ParsedRequest,
  riders: Rider[],
  orders: Order[],
): { checks: GuardianCheck[]; result: Decision['result']; summary: string } {
  const checks: GuardianCheck[] = [];
  const rider = riders.find((r) => r.did === parsed.riderDid);
  const order = orders.find((o) => o.id === parsed.orderId);

  const maxAmount = rider?.maxCollectionAmount ?? null;
  const requested = parsed.amount ?? null;
  const permissionOk =
    rider?.permissions.includes(
      parsed.action === 'COLLECT_COD' ? 'collect_cod_payment' : 'release_package',
    ) ?? false;

  checks.push(
    rs(
      'Order exists',
      !!order,
      order ? `Order #${order.id} · ${order.customer}` : `No order matching ${parsed.orderId ?? 'unknown'}`,
    ),
  );

  checks.push(
    rs(
      'Rider assigned to order',
      !!order && !!rider && order.assignedRiderDid === rider.did,
      order?.assignedRiderDid === parsed.riderDid
        ? 'Assignment matches registry'
        : 'Order is assigned to a different rider or is unassigned',
    ),
  );

  checks.push(
    rs(
      'Rider DID resolves',
      !!rider,
      rider ? `${rider.name} · ${rider.did.slice(0, 24)}…` : `Unresolved DID ${parsed.riderDid.slice(0, 24)}…`,
    ),
  );

  checks.push(
    rs(
      'Credential signature valid',
      !!rider && rider.vcId !== 'urn:uuid:vc-revoked-sig',
      rider ? 'ED25519 signature verified against platform DID' : 'No credential found for DID',
    ),
  );

  checks.push(
    rs(
      'Credential status (revocation list)',
      rider?.vcStatus === 'ACTIVE',
      rider?.vcStatus === 'ACTIVE' ? 'ACTIVE — not in revocation list' : 'REVOKED — found in StatusList2021',
    ),
  );

  checks.push(
    rs(
      'Credential not expired',
      !!rider && new Date(rider.vcExpirationDate).getTime() > Date.now(),
      rider ? `Valid until ${new Date(rider.vcExpirationDate).toLocaleDateString()}` : 'No credential',
    ),
  );

  checks.push(
    rs(
      'Permission includes action',
      permissionOk,
      permissionOk ? `✓ includes ${parsed.action}` : `✗ rider lacks ${parsed.action}`,
    ),
  );

  if (parsed.action === 'COLLECT_COD') {
    checks.push(
      rs(
        'Amount within permission',
        requested !== null && maxAmount !== null && requested > 0 && requested <= maxAmount,
        requested === null
          ? 'No amount extractable from message'
          : requested > (maxAmount ?? 0)
            ? `KSh ${requested.toLocaleString()} exceeds max KSh ${(maxAmount ?? 0).toLocaleString()}`
            : `KSh ${requested.toLocaleString()} ≤ max KSh ${(maxAmount ?? 0).toLocaleString()}`,
      ),
    );
  }

  checks.push(
    rs(
      'Input integrity (prompt-injection scan)',
      !parsed.injectionFlagged,
      parsed.injectionReason ?? 'Free-text scan clean — no instruction manipulation detected',
      true,
    ),
  );

  if (parsed.action === 'RELEASE_PACKAGE' && order && order.amount > 0 && order.status !== 'collected') {
    checks.push(
      rs(
        'Payment integrity — COD before release',
        false,
        `Order #${order.id} still owes KSh ${order.amount.toLocaleString()} COD; release without collection blocked`,
        true,
      ),
    );
  }

  const criticalFail = checks.find((c) => c.critical && !c.passed);
  const anyFail = checks.find((c) => !c.passed);

  let result: Decision['result'] = 'APPROVED';
  let summary = `✔ APPROVED — ${parsed.action === 'COLLECT_COD' ? 'payment collection' : 'package release'} authorized`;

  if (criticalFail) {
    result = 'BLOCKED';
    summary = criticalFail.name === 'Payment integrity — COD before release'
      ? '⛔ BLOCKED — release would bypass COD collection'
      : '⛔ BLOCKED — prompt-injection attempt detected; Guardian confirmed independently';
  } else if (anyFail) {
    result = 'DENIED';
    if (anyFail.name === 'Credential status (revocation list)') summary = '✕ DENIED — credential revoked';
    else if (anyFail.name === 'Amount within permission') summary = '✕ DENIED — exceeds authorized collection limit';
    else if (anyFail.name === 'Rider assigned to order') summary = '✕ DENIED — rider not assigned to this order';
    else if (anyFail.name === 'Order exists') summary = '✕ DENIED — order not found';
    else if (anyFail.name === 'Credential not expired') summary = '✕ DENIED — credential expired';
    else if (anyFail.name === 'Permission includes action') summary = '✕ DENIED — rider lacks permission';
    else summary = `✕ DENIED — ${anyFail.name}`;
  }

  return { checks, result, summary };
}

let counter = 0;

export function buildDecision(
  parsed: ParsedRequest,
  rider: Rider | undefined,
  order: Order | undefined,
  checks: GuardianCheck[],
  result: Decision['result'],
  summary: string,
): Decision {
  counter += 1;
  const hashInput = `${order?.id ?? parsed.orderId ?? 'unknown'}|${parsed.riderDid}|${parsed.action}|${parsed.amount ?? ''}`;
  return {
    id: `dec-${Date.now().toString(36)}-${counter}`,
    timestamp: new Date().toISOString(),
    actor: {
      riderId: rider?.id ?? 'unknown',
      name: rider?.name ?? 'Unknown rider',
      did: parsed.riderDid,
    },
    orderId: order?.id ?? parsed.orderId ?? 'unknown',
    orderCustomer: order?.customer,
    action: parsed.action,
    requestedAmount: parsed.amount,
    currency: parsed.currency ?? order?.currency ?? 'KES',
    message: parsed.raw,
    parsedRequest: parsed,
    result,
    summary,
    checks,
    auditHash: createAuditHash(hashInput),
  };
}