import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { onAuthState, logout as authLogout } from "@/services/authService.js";
import {
  fetchUserCart,
  saveUserCart,
  fetchUserWishlist,
  saveUserWishlist,
  fetchUserOrdersFromFirestore,
  updateUserProfileInFirestore,
  saveUserAddressInFirestore,
} from "@/firebase/firestore.js";

const StoreContext = createContext(null);
const KEY = "nexus-store-v2";

export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);
  const isInitialMount = useRef(true);

  // 1. Initial load from localStorage for instant guest responsiveness
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (Array.isArray(s.cart)) setCart(s.cart);
      if (Array.isArray(s.wishlist)) setWishlist(s.wishlist);
      if (Array.isArray(s.orders)) setOrders(s.orders);
    } catch {}
  }, []);

  // 2. Synchronize with Firebase Auth session and Firestore
  useEffect(() => {
    const unsubscribe = onAuthState(async (authUser) => {
      if (authUser) {
        setUser(authUser);
        try {
          // Fetch user cart from Firestore
          const firestoreCart = await fetchUserCart(authUser.uid);
          setCart((localCart) => {
            // Merge local guest cart items with remote Firestore cart
            const merged = [...firestoreCart];
            for (const localItem of localCart) {
              const existing = merged.find((i) => i.id === localItem.id);
              if (existing) {
                existing.qty = Math.max(existing.qty, localItem.qty);
              } else {
                merged.push(localItem);
              }
            }
            // Save merged back to Firestore
            if (merged.length > 0) {
              saveUserCart(authUser.uid, merged);
            }
            return merged;
          });

          // Fetch user wishlist from Firestore
          const firestoreWishlist = await fetchUserWishlist(authUser.uid);
          setWishlist((localWishlist) => {
            const mergedWishlist = Array.from(new Set([...firestoreWishlist, ...localWishlist]));
            if (mergedWishlist.length > 0) {
              saveUserWishlist(authUser.uid, mergedWishlist);
            }
            return mergedWishlist;
          });

          // Fetch user orders from Firestore
          const firestoreOrders = await fetchUserOrdersFromFirestore(authUser.uid);
          if (firestoreOrders.length > 0) {
            setOrders(firestoreOrders);
          }
        } catch (err) {
          console.error("Error loading user data from Firestore:", err);
        }
      } else {
        setUser(null);
      }
      setReady(true);
      isInitialMount.current = false;
    });

    return () => unsubscribe();
  }, []);

  // 3. Persist state to localStorage and Firestore on state change
  useEffect(() => {
    if (ready) {
      localStorage.setItem(KEY, JSON.stringify({ cart, wishlist, orders }));
      if (user && user.uid && !isInitialMount.current) {
        saveUserCart(user.uid, cart);
        saveUserWishlist(user.uid, wishlist);
      }
    }
  }, [cart, wishlist, orders, user, ready]);

  // Cart operations
  const addToCart = useCallback((p, qty = 1) => {
    const stockAvailable = p.stock ?? p.storeStock ?? 0;
    if (stockAvailable === 0) return toast.error("This component is currently out of stock");

    setCart((current) => {
      const ex = current.find((i) => i.id === p.id);
      if (ex) {
        const newQty = Math.min(ex.qty + qty, stockAvailable);
        return current.map((i) => (i.id === p.id ? { ...i, qty: newQty } : i));
      }
      return [
        ...current,
        {
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.image,
          stock: stockAvailable,
          qty: Math.min(qty, stockAvailable),
        },
      ];
    });

    toast.success(`${p.name} added to cart`);
  }, []);

  const updateQty = useCallback((id, qty) => {
    setCart((current) =>
      current.map((i) => {
        if (i.id === id) {
          const max = i.stock || 99;
          const safeQty = Math.max(1, Math.min(qty, max));
          return { ...i, qty: safeQty };
        }
        return i;
      }),
    );
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((current) => current.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    if (user && user.uid) {
      saveUserCart(user.uid, []);
    }
  }, [user]);

  // Wishlist operations
  const toggleWishlist = useCallback((p) => {
    setWishlist((w) => {
      const id = typeof p === "string" ? p : p.id;
      const name = typeof p === "string" ? "Component" : p.name;
      if (w.includes(id)) {
        toast("Removed from wishlist");
        return w.filter((x) => x !== id);
      }
      toast.success(`${name} saved to wishlist`);
      return [...w, id];
    });
  }, []);

  const moveToCart = useCallback(
    (p) => {
      addToCart(p, 1);
      setWishlist((w) => w.filter((x) => x !== (typeof p === "string" ? p : p.id)));
    },
    [addToCart],
  );

  // Profile operations
  const updateUser = useCallback(
    async (updates) => {
      setUser((prev) => ({ ...prev, ...updates }));
      if (user && user.uid) {
        try {
          await updateUserProfileInFirestore(user.uid, updates);
          toast.success("Profile saved");
        } catch (err) {
          console.error("Failed to update profile in Firestore:", err);
        }
      }
    },
    [user],
  );

  const addAddress = useCallback(
    async (address) => {
      if (!user || !user.uid) return;
      try {
        const updatedList = await saveUserAddressInFirestore(user.uid, address);
        setUser((prev) => ({ ...prev, addresses: updatedList }));
        toast.success("Address saved");
      } catch (err) {
        toast.error("Failed to save address");
      }
    },
    [user],
  );

  const logout = useCallback(async () => {
    try {
      await authLogout();
    } catch {}
    setUser(null);
    setOrders([]);
    toast.success("Signed out successfully");
  }, []);

  const addOrder = useCallback((o) => {
    setOrders((current) => [o, ...current]);
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
  const isAdmin = Boolean(user && user.role === "admin");

  const value = {
    ready,
    cart,
    wishlist,
    user,
    isAdmin,
    orders,
    cartCount,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    toggleWishlist,
    moveToCart,
    login: setUser,
    logout,
    updateUser,
    addAddress,
    addOrder,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
