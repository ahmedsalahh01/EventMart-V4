import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { normalizeCartItem } from "../lib/cart";
import { getSelectedEventType, syncCartBehavior, trackAddToCart } from "../lib/userBehavior";

const CartContext = createContext(null);
const STORAGE_KEY = "eventmart_cart_v1";

function readItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeCartItem).filter((item) => item.id) : [];
  } catch (_error) {
    return [];
  }
}

function CartProvider({ children }) {
  const [items, internalSetItems] = useState(readItems);

  function persist(nextItems) {
    internalSetItems(nextItems);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
    } catch (_error) {
      // Ignore storage errors.
    }
    window.dispatchEvent(new CustomEvent("eventmart:cart-updated"));
  }

  function setItems(next) {
    const nextItems = typeof next === "function" ? next(items).map(normalizeCartItem) : next.map(normalizeCartItem);
    persist(nextItems.filter((item) => item.id));
  }

  function addItem(product, quantity = 1, mode = "buy", options = {}) {
    const unitPrice =
      mode === "rent" && product.rent_enabled && product.rent_price_per_day !== null
        ? Number(product.rent_price_per_day)
        : Number(product.buy_price ?? product.rent_price_per_day ?? 0);

    const stock = Number(options.stock ?? product.quantity_available ?? 0);
    const variationId =
      options.variation_id === null || options.variation_id === undefined || options.variation_id === ""
        ? null
        : String(options.variation_id);
    const uploadTokens = Array.isArray(options.customization_uploads)
      ? options.customization_uploads
          .map((upload) => String(upload?.uploadToken || upload?.upload_token || "").trim())
          .filter(Boolean)
      : [];
    const cartItemKey = [
      String(product.id),
      mode,
      variationId || "default",
      uploadTokens.join(":") || "plain"
    ].join("|");

    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.cart_item_key === cartItemKey);
      if (existingIndex >= 0) {
        return current.map((item, index) => {
          if (index !== existingIndex) return item;
          const nextQuantity = stock > 0 ? Math.min(item.quantity + Number(quantity || 1), stock) : item.quantity + Number(quantity || 1);
          return {
            ...item,
            quantity: nextQuantity,
            rental_days: item.mode === "rent" ? Math.max(1, Number(item.rental_days || 1)) : 1,
            unit_price: unitPrice,
            stock,
            category: product.category || item.category || "General",
            subcategory: product.subcategory || item.subcategory || "General",
            description: product.description || item.description || "",
            variation_id: variationId,
            selected_color: String(options.selected_color || item.selected_color || ""),
            selected_size: String(options.selected_size || item.selected_size || ""),
            sku: String(options.sku || item.sku || ""),
            customization_uploads: Array.isArray(options.customization_uploads)
              ? options.customization_uploads
              : item.customization_uploads,
            customization_requested:
              Boolean(options.customization_requested) || item.customization_requested,
            image_url: product.image_url || product.images?.[0] || item.image_url,
            images:
              Array.isArray(product.images) && product.images.length
                ? product.images
                : item.images,
            customizable: Boolean(product.customizable || item.customizable),
            buy_enabled: Boolean(product.buy_enabled ?? item.buy_enabled),
            rent_enabled: Boolean(product.rent_enabled ?? item.rent_enabled),
            event_type_hint: String(options.event_type || item.event_type_hint || getSelectedEventType() || "")
          };
        });
      }

        return [
        ...current,
        normalizeCartItem({
          cart_item_key: cartItemKey,
          id: String(product.id),
          product_id: String(product.product_id || ""),
          name: product.name,
          slug: product.slug || "",
          category: product.category || "General",
          subcategory: product.subcategory || "General",
          description: product.description || "",
          image_url: product.image_url || product.images?.[0] || "",
          images: Array.isArray(product.images) ? product.images : [],
          mode,
          variation_id: variationId,
          selected_color: String(options.selected_color || ""),
          selected_size: String(options.selected_size || ""),
          sku: String(options.sku || ""),
          customization_uploads: Array.isArray(options.customization_uploads)
            ? options.customization_uploads
            : [],
          customization_requested: Boolean(options.customization_requested),
          quantity,
          rental_days: mode === "rent" ? 1 : 1,
          unit_price: unitPrice,
          currency: product.currency || "USD",
          stock,
          customizable: Boolean(product.customizable),
          buy_enabled: Boolean(product.buy_enabled),
          rent_enabled: Boolean(product.rent_enabled),
          event_type_hint: String(options.event_type || getSelectedEventType() || "")
        })
      ];
    });

    trackAddToCart(product, {
      quantity,
      mode,
      eventType: options.event_type || getSelectedEventType(),
      customizationRequested: Boolean(options.customization_requested)
    });
  }

  function updateQuantity(cartItemKey, quantity) {
    const nextQuantity = Math.max(1, Number(quantity || 1));
    setItems((current) =>
      current.map((item) => {
        if (item.cart_item_key !== String(cartItemKey)) return item;
        const safeQuantity = item.stock > 0 ? Math.min(nextQuantity, item.stock) : nextQuantity;
        return { ...item, quantity: safeQuantity };
      })
    );
  }

  function updateRentalDays(cartItemKey, days) {
    const nextDays = Math.max(1, Number(days || 1));
    setItems((current) =>
      current.map((item) => {
        if (item.cart_item_key !== String(cartItemKey)) return item;
        if (item.mode !== "rent") return item;
        return { ...item, rental_days: nextDays };
      })
    );
  }

  function removeItem(cartItemKey) {
    setItems((current) => current.filter((item) => item.cart_item_key !== String(cartItemKey)));
  }

  function clearCart() {
    persist([]);
  }

  const itemCount = items.reduce((total, item) => total + Number(item.quantity || 0), 0);

  useEffect(() => {
    syncCartBehavior(items, { eventType: getSelectedEventType() });
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      itemCount,
      setItems,
      addItem,
      updateQuantity,
      updateRentalDays,
      removeItem,
      clearCart
    }),
    [items, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}

export { CartProvider, useCart };
