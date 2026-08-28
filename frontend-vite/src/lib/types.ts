export type VcStatus = 'ACTIVE' | 'REVOKED';

export type Permission = 'collect_cod_payment' | 'release_package';

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string;
    role: string;
    permissions: Permission[];
    maxCollectionAmount: number;
    currency: string;
    status: VcStatus;
  };
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws: string;
  };
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  role: 'delivery_rider';
  did: string;
  permissions: Permission[];
  maxCollectionAmount: number;
  currency: string;
  vcStatus: VcStatus;
  vcIssuanceDate: string;
  vcExpirationDate: string;
  vcId: string;
  assignedOrders: string[];
}

export type OrderStatus = 'pending' | 'approved' | 'denied' | 'collected';

export interface Order {
  id: string;
  customer: string;
  address: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  assignedRiderDid: string | null;
  createdAt: string;
}

export type ActionType = 'COLLECT_COD' | 'RELEASE_PACKAGE';

export interface ParsedRequest {
  orderId: string | null;
  riderDid: string;
  action: ActionType;
  amount: number | null;
  currency: string | null;
  raw: string;
  injectionFlagged: boolean;
  injectionReason?: string;
}

export interface GuardianCheck {
  name: string;
  passed: boolean;
  detail: string;
  critical?: boolean;
}

export type DecisionResult = 'APPROVED' | 'DENIED' | 'BLOCKED';

export interface Decision {
  id: string;
  timestamp: string;
  actor: {
    riderId: string;
    name: string;
    did: string;
  };
  orderId: string;
  orderCustomer?: string;
  action: ActionType;
  requestedAmount: number | null;
  currency: string;
  message: string;
  parsedRequest: ParsedRequest;
  result: DecisionResult;
  summary: string;
  checks: GuardianCheck[];
  auditHash: string;
  matchedCard?: string | null;
}

export type SessionRole = 'dispatcher' | 'rider';

export interface Session {
  role: SessionRole;
  userName: string;
  riderId?: string;
}

export type FeedEvent =
  | { kind: 'check'; index: number; check: GuardianCheck }
  | { kind: 'done'; decision: Decision };

export interface RunResult {
  decision: Decision;
}