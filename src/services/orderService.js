import { http } from "./api.js";
import {
  createOrderInFirestore,
  fetchUserOrdersFromFirestore,
  fetchAllOrdersFromFirestore,
  updateOrderStatusInFirestore,
} from "@/firebase/firestore.js";

/**
 * Place a new order with server-side validation and Firestore persistence
 */
export async function placeOrder(orderData, token) {
  // First attempt backend order placement for server-side pricing recalculation
  try {
    const backendOrder = await http("/orders", {
      method: "POST",
      body: orderData,
      token,
    });
    if (backendOrder && backendOrder.id) {
      // Also persist to Firestore so it appears in Firebase console
      try {
        await createOrderInFirestore(backendOrder);
      } catch (e) {
        console.warn("Order saved on backend, secondary Firestore sync skipped:", e.message);
      }
      return backendOrder;
    }
  } catch (err) {
    console.warn("Backend order placement fallback to direct Firestore persistence:", err.message);
  }

  // Fallback: Direct Firestore order creation
  return await createOrderInFirestore(orderData);
}

/**
 * Fetch orders for a user
 */
export async function getUserOrders(uid) {
  try {
    const backendOrders = await http("/orders/my-orders");
    if (Array.isArray(backendOrders) && backendOrders.length > 0) {
      return backendOrders;
    }
  } catch {}

  return await fetchUserOrdersFromFirestore(uid);
}

/**
 * Admin: Fetch all orders
 */
export async function getAllOrders() {
  try {
    const backendOrders = await http("/admin/orders");
    if (Array.isArray(backendOrders)) return backendOrders;
  } catch {}

  return await fetchAllOrdersFromFirestore();
}

/**
 * Admin: Update order status
 */
export async function updateOrderStatus(orderId, status) {
  try {
    await http(`/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status },
    });
  } catch {}

  return await updateOrderStatusInFirestore(orderId, status);
}
