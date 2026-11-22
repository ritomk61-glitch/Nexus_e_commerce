import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config.js";
import { products as initialProducts, categories as initialCategories } from "@/data/products.js";

// ==========================================
// PRODUCTS & CATEGORIES
// ==========================================

export async function fetchProductsFromFirestore() {
  try {
    const colRef = collection(db, "products");
    const snap = await getDocs(colRef);
    if (snap.empty) {
      // Auto-seed if collection is currently empty
      await seedInitialProductsIfEmpty();
      return initialProducts;
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Firestore fetchProducts error, falling back to local dataset:", err);
    return initialProducts;
  }
}

export async function fetchProductByIdFromFirestore(id) {
  try {
    const docRef = doc(db, "products", id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    // Fallback to local
    const local = initialProducts.find((p) => p.id === id);
    if (local) return local;
    throw new Error("Product not found");
  } catch (err) {
    const local = initialProducts.find((p) => p.id === id);
    if (local) return local;
    throw err;
  }
}

export async function seedInitialProductsIfEmpty() {
  try {
    const colRef = collection(db, "products");
    const snap = await getDocs(query(colRef, limit(1)));
    if (!snap.empty) return; // already seeded

    const batch = writeBatch(db);

    // Seed products
    for (const p of initialProducts) {
      const pRef = doc(db, "products", p.id);
      batch.set(pRef, {
        id: p.id,
        sku: p.id.toUpperCase(),
        name: p.name,
        slug: p.id,
        description: p.description,
        category: p.category,
        brand: p.brand,
        image: p.image,
        gallery: p.images || [p.image],
        specs: p.specs || {},
        datasheetUrl: null,
        supplier: "Source Parts Global",
        supplierPrice: Math.round(p.price * 0.7),
        supplierCurrency: "INR",
        supplierStock: (p.stock || 50) + 100,
        sellingPrice: p.price,
        discountPrice: p.mrp,
        price: p.price,
        mrp: p.mrp,
        storeStock: p.stock ?? 50,
        stock: p.stock ?? 50,
        rating: p.rating || 4.5,
        reviews: p.reviews || 10,
        featured: !!p.featured,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Seed categories
    for (const c of initialCategories) {
      const cRef = doc(db, "categories", c.id);
      batch.set(cRef, {
        id: c.id,
        name: c.name,
        image: c.image,
        blurb: c.blurb,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
    console.log("Successfully seeded Firestore with NEXUS products and categories.");
  } catch (err) {
    console.warn("Could not seed initial products to Firestore:", err);
  }
}

export async function saveProductToFirestore(product) {
  const id = product.id || `nx-${Date.now()}`;
  const docRef = doc(db, "products", id);
  const data = {
    ...product,
    id,
    sku: product.sku || id.toUpperCase(),
    price: Number(product.price || product.sellingPrice || 0),
    mrp: Number(product.mrp || product.discountPrice || product.price || 0),
    stock: Number(product.stock ?? product.storeStock ?? 0),
    storeStock: Number(product.stock ?? product.storeStock ?? 0),
    sellingPrice: Number(product.price || product.sellingPrice || 0),
    updatedAt: serverTimestamp(),
  };
  if (!product.createdAt) {
    data.createdAt = serverTimestamp();
  }
  await setDoc(docRef, data, { merge: true });
  return { id, ...data };
}

export async function deleteProductFromFirestore(id) {
  const docRef = doc(db, "products", id);
  await deleteDoc(docRef);
  return { success: true, id };
}

// ==========================================
// CART PERSISTENCE (users/{uid} or carts/{uid})
// ==========================================

export async function fetchUserCart(uid) {
  if (!uid) return [];
  try {
    const docRef = doc(db, "carts", uid);
    const snap = await getDoc(docRef);
    if (snap.exists() && Array.isArray(snap.data()?.items)) {
      return snap.data().items;
    }
    return [];
  } catch (err) {
    console.error("Error fetching user cart from Firestore:", err);
    return [];
  }
}

export async function saveUserCart(uid, items) {
  if (!uid) return;
  try {
    const docRef = doc(db, "carts", uid);
    await setDoc(
      docRef,
      {
        uid,
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          image: i.image,
          stock: i.stock,
          qty: i.qty,
        })),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("Error saving user cart to Firestore:", err);
  }
}

// ==========================================
// WISHLIST PERSISTENCE
// ==========================================

export async function fetchUserWishlist(uid) {
  if (!uid) return [];
  try {
    const docRef = doc(db, "wishlists", uid);
    const snap = await getDoc(docRef);
    if (snap.exists() && Array.isArray(snap.data()?.items)) {
      return snap.data().items;
    }
    return [];
  } catch (err) {
    console.error("Error fetching user wishlist:", err);
    return [];
  }
}

export async function saveUserWishlist(uid, items) {
  if (!uid) return;
  try {
    const docRef = doc(db, "wishlists", uid);
    await setDoc(
      docRef,
      {
        uid,
        items,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("Error saving user wishlist:", err);
  }
}

// ==========================================
// ORDERS
// ==========================================

export async function createOrderInFirestore(orderData) {
  const orderId = orderData.id || `NX${Date.now().toString().slice(-8)}`;
  const orderRef = doc(db, "orders", orderId);

  const newOrder = {
    id: orderId,
    userId: orderData.userId || null,
    customerName: orderData.shipping?.name || "Customer",
    customerEmail: orderData.shipping?.email || orderData.userEmail || "",
    customerPhone: orderData.shipping?.phone || "",
    shipping: {
      name: orderData.shipping?.name || "",
      phone: orderData.shipping?.phone || "",
      address: orderData.shipping?.address || "",
      city: orderData.shipping?.city || "",
      state: orderData.shipping?.state || "",
      pincode: orderData.shipping?.pincode || "",
    },
    items: orderData.items.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
      image: i.image,
    })),
    subtotal: orderData.subtotal,
    discount: orderData.discount || 0,
    shippingFee: orderData.shippingFee ?? orderData.shipping ?? 0,
    gst: orderData.gst || 0,
    total: orderData.total,
    paymentMethod: orderData.payment || "cod",
    paymentStatus: orderData.payment === "cod" ? "Pending on Delivery" : "Simulated / Confirmed",
    status: "Confirmed",
    createdAt: new Date().toISOString(),
    serverCreatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(orderRef, newOrder);
  return newOrder;
}

export async function fetchUserOrdersFromFirestore(uid) {
  if (!uid) return [];
  try {
    const colRef = collection(db, "orders");
    const q = query(colRef, where("userId", "==", uid));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Sort in memory by createdAt descending
    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (err) {
    console.error("Error fetching user orders:", err);
    return [];
  }
}

export async function fetchAllOrdersFromFirestore() {
  try {
    const colRef = collection(db, "orders");
    const snap = await getDocs(colRef);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (err) {
    console.error("Error fetching all orders for admin:", err);
    return [];
  }
}

export async function updateOrderStatusInFirestore(orderId, status) {
  const docRef = doc(db, "orders", orderId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });
  return { success: true, orderId, status };
}

// ==========================================
// USER PROFILE & ADDRESSES
// ==========================================

export async function updateUserProfileInFirestore(uid, updates) {
  if (!uid) throw new Error("User UID required");
  const docRef = doc(db, "users", uid);
  // Strip out sensitive fields like role or uid to prevent privilege escalation
  const safeUpdates = { ...updates };
  delete safeUpdates.role;
  delete safeUpdates.uid;
  delete safeUpdates.email;
  safeUpdates.updatedAt = serverTimestamp();

  await updateDoc(docRef, safeUpdates);
  return safeUpdates;
}

export async function saveUserAddressInFirestore(uid, address) {
  if (!uid) throw new Error("User UID required");
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const currentAddresses = snap.exists() ? snap.data().addresses || [] : [];
  const addressId = address.id || `addr_${Date.now()}`;
  const updatedList = [
    ...currentAddresses.filter((a) => a.id !== addressId),
    { ...address, id: addressId },
  ];
  await updateDoc(userRef, {
    addresses: updatedList,
    updatedAt: serverTimestamp(),
  });
  return updatedList;
}

// ==========================================
// ADMIN DASHBOARD STATS
// ==========================================

export async function fetchAdminStats() {
  try {
    const [pSnap, oSnap, uSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "users")),
    ]);

    const totalProducts = pSnap.size || initialProducts.length;
    const totalUsers = uSnap.size;
    const orders = oSnap.docs.map((d) => d.data());
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return {
      totalProducts,
      totalUsers,
      totalOrders,
      totalRevenue,
      lowStockProducts: pSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => (p.stock ?? 0) <= 5),
    };
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    return {
      totalProducts: initialProducts.length,
      totalUsers: 1,
      totalOrders: 0,
      totalRevenue: 0,
      lowStockProducts: [],
    };
  }
}
