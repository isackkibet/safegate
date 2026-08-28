import fetch from "node-fetch";
import type { Order } from "@safegate/shared-types";

export interface OrderCheckResult {
  orderExists: boolean;
  riderAssignedToOrder: boolean;
  orderAmount?: number;
  orderCurrency?: string;
}

/**
 * Validates order status from Backend:
 * 1. Checks if order exists.
 * 2. Checks if the request's rider DID is assigned to the order.
 */
export async function checkOrderAssignment(
  orderId: string,
  riderDid: string,
  backendUrl: string
): Promise<OrderCheckResult> {
  try {
    const res = await fetch(`${backendUrl}/orders/${encodeURIComponent(orderId)}`);
    if (res.status === 404) {
      return { orderExists: false, riderAssignedToOrder: false };
    }
    if (!res.ok) {
      throw new Error(`Backend order status check returned ${res.status}`);
    }

    const order = (await res.json()) as Order;

    return {
      orderExists: true,
      riderAssignedToOrder: order.riderDid === riderDid,
      orderAmount: order.amount,
      orderCurrency: order.currency,
    };
  } catch (error) {
    console.error("Order check failed:", error);
    return { orderExists: false, riderAssignedToOrder: false };
  }
}
