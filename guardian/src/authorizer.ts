import type { StructuredRequest, GuardianDecision } from "@safegate/shared-types";
import { resolveRiderDid } from "./checks/didCheck.js";
import { checkOrderAssignment } from "./checks/orderCheck.js";
import { checkVerifiableCredential } from "./checks/vcCheck.js";
import { checkPermissionsAndLimits } from "./checks/permissionCheck.js";
import fetch from "node-fetch";

/**
 * Deterministically authorizes a delivery request.
 * Contains no LLM or AI layers.
 */
export async function authorizeRequest(
  request: StructuredRequest,
  backendUrl: string
): Promise<GuardianDecision> {
  const { orderId, riderDid, action, amount, currency } = request;

  // 1. Resolve DID
  const didDoc = await resolveRiderDid(riderDid);
  const riderDidResolves = didDoc !== null;

  // 2. Fetch VC from backend to check it
  let vcJson: Record<string, any> | undefined;
  try {
    const res = await fetch(`${backendUrl}/riders/${encodeURIComponent(riderDid)}/credential`);
    if (res.ok) {
      const data = (await res.json()) as { vc?: Record<string, any> };
      vcJson = data.vc;
    }
  } catch (err) {
    console.error(`Failed to fetch VC details for rider ${riderDid} from backend:`, err);
  }

  // 3. Verify VC crypto, expiry, and revocation
  const vcCheck = await checkVerifiableCredential(vcJson, riderDid, backendUrl);
  const vcSignatureValid = vcCheck.signatureValid;
  const vcStatus = vcCheck.status;

  // 4. Verify Order assignment
  const orderCheck = await checkOrderAssignment(orderId, riderDid, backendUrl);
  const orderExists = orderCheck.orderExists;
  const riderAssignedToOrder = orderCheck.riderAssignedToOrder;

  // 5. Verify Permissions and amount limits
  const permCheck = checkPermissionsAndLimits(
    vcCheck.vc,
    action,
    amount,
    currency
  );
  const permissionIncludesAction = permCheck.permissionIncludesAction;
  const amountWithinLimit = permCheck.amountWithinLimit;

  // Assemble checks object
  const checks: GuardianDecision["checks"] = {
    orderExists,
    riderDidResolves,
    vcSignatureValid,
    riderAssignedToOrder,
    vcStatus,
    permissionIncludesAction,
    amountWithinLimit,
  };

  // Decision logic
  const isApproved =
    orderExists &&
    riderDidResolves &&
    vcSignatureValid &&
    riderAssignedToOrder &&
    vcStatus === "ACTIVE" &&
    permissionIncludesAction &&
    amountWithinLimit;

  let reason: string | undefined;
  if (!isApproved) {
    const reasons: string[] = [];
    if (!orderExists) reasons.push("order does not exist");
    else if (!riderAssignedToOrder) reasons.push("rider is not assigned to this order");
    if (!riderDidResolves) reasons.push("rider DID could not be resolved");
    if (!vcSignatureValid) reasons.push("VC signature is invalid or tampered");
    if (vcStatus === "REVOKED") reasons.push("rider credential is revoked");
    else if (vcStatus === "EXPIRED") reasons.push("rider credential has expired");
    else if (vcStatus === "UNKNOWN") reasons.push("rider credential status is unknown");
    if (!permissionIncludesAction) reasons.push(`rider permission does not cover action '${action}'`);
    if (!amountWithinLimit) reasons.push(`request amount ${amount} ${currency} exceeds rider limit`);

    reason = "Authorization denied: " + reasons.join(", ");
  }

  return {
    decision: isApproved ? "APPROVED" : "DENIED",
    reason,
    checks,
  };
}
