import type { DeliveryRiderVC, DeliveryAction } from "@safegate/shared-types";

export interface PermissionCheckResult {
  permissionIncludesAction: boolean;
  amountWithinLimit: boolean;
}

/**
 * Verifies that the VC permissions and limits cover the requested action/amount.
 */
export function checkPermissionsAndLimits(
  vc: DeliveryRiderVC | undefined,
  action: "COLLECT_COD" | "RELEASE_PACKAGE" | "COLLECT_AND_RELEASE",
  amount: number,
  currency: string
): PermissionCheckResult {
  if (!vc) {
    return { permissionIncludesAction: false, amountWithinLimit: false };
  }

  const { permissions, maxAmount, currency: limitCurrency } = vc.credentialSubject;

  // 1. Permission checks
  let permissionIncludesAction = false;

  const hasCollect = permissions.includes("COLLECT_COD") || permissions.includes("COLLECT_AND_RELEASE");
  const hasRelease = permissions.includes("RELEASE_PACKAGE") || permissions.includes("COLLECT_AND_RELEASE");

  if (action === "COLLECT_COD") {
    permissionIncludesAction = hasCollect;
  } else if (action === "RELEASE_PACKAGE") {
    permissionIncludesAction = hasRelease;
  } else if (action === "COLLECT_AND_RELEASE") {
    permissionIncludesAction = hasCollect && hasRelease;
  }

  // 2. Amount limit check
  // Currency check (if they mismatch, block for safety)
  const currencyMatches = currency.toUpperCase() === limitCurrency.toUpperCase();
  const amountWithinLimit = currencyMatches && amount <= maxAmount;

  return {
    permissionIncludesAction,
    amountWithinLimit,
  };
}
