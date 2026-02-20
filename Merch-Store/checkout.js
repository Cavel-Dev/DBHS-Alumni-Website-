const STORE_REGIONS = {
  jamaica: { label: "Jamaica", symbol: "JMD $", locale: "en-JM", fx: 1 },
  us: { label: "United States", symbol: "US $", locale: "en-US", fx: 1 / 155 },
  uk: { label: "United Kingdom", symbol: "GBP ", locale: "en-GB", fx: 1 / 198 }
};

const cartList = document.getElementById("cartList");
const subtotalValue = document.getElementById("subtotalValue");
const shippingValue = document.getElementById("shippingValue");
const totalValue = document.getElementById("totalValue");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const clearCartBtn = document.getElementById("clearCartBtn");
const statusBox = document.getElementById("status");
const regionSelect = document.getElementById("regionSelect");

let cart = readCart();
let storeRegion = localStorage.getItem("dbhs_store_region") || "jamaica";
let productsData = Array.isArray(window.PRODUCTS) ? [...window.PRODUCTS] : [];

regionSelect.value = storeRegion;

function readCart() {
  try {
    const saved = localStorage.getItem("dbhs_merch_cart");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function writeCart(nextCart) {
  cart = nextCart;
  localStorage.setItem("dbhs_merch_cart", JSON.stringify(nextCart));
}

function getCartEntries() {
  return Object.entries(cart)
    .map(([id, qty]) => {
      const product = productsData.find((item) => String(item.id) === String(id));
      if (!product) return null;
      return { product, qty: Number(qty) || 0 };
    })
    .filter((item) => item && item.qty > 0);
}

function formatCurrency(value) {
  const config = STORE_REGIONS[storeRegion] || STORE_REGIONS.jamaica;
  const converted = Number(value || 0) * config.fx;
  const amount = converted.toLocaleString(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${config.symbol}${amount}`;
}

function calculateTotals(entries) {
  const subtotal = entries.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const shipping = subtotal > 0 ? 950 : 0;
  return { subtotal, shipping, total: subtotal + shipping };
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.className = `status${isError ? " error" : ""}`;
}

function changeQty(id, delta) {
  const next = { ...cart };
  const amount = (Number(next[id]) || 0) + delta;
  if (amount <= 0) delete next[id];
  else next[id] = amount;
  writeCart(next);
  render();
}

function removeItem(id) {
  const next = { ...cart };
  delete next[id];
  writeCart(next);
  render();
}

function render() {
  const entries = getCartEntries();

  if (!entries.length) {
    cartList.innerHTML = '<p class="empty">Your cart is empty.</p>';
  } else {
    cartList.innerHTML = entries
      .map(({ product, qty }) => {
        const lineTotal = product.price * qty;
        return `
          <article class="cart-item">
            <div>
              <h3>${product.name}</h3>
              <p class="meta">${formatCurrency(product.price)} each</p>
              <p class="meta">Line total: ${formatCurrency(lineTotal)}</p>
            </div>
            <div>
              <div class="qty-box">
                <button type="button" data-action="decrease" data-id="${product.id}" aria-label="Decrease quantity">-</button>
                <strong>${qty}</strong>
                <button type="button" data-action="increase" data-id="${product.id}" aria-label="Increase quantity">+</button>
              </div>
              <button type="button" data-action="remove" data-id="${product.id}" class="remove-btn">Remove</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  const totals = calculateTotals(entries);
  subtotalValue.textContent = formatCurrency(totals.subtotal);
  shippingValue.textContent = formatCurrency(totals.shipping);
  totalValue.textContent = formatCurrency(totals.total);
  placeOrderBtn.disabled = entries.length === 0;
}

async function saveOrderToSupabase(entries, totals) {
  if (!window.dbhsSupabase || entries.length === 0) return { ok: true };

  const { data: sessionData, error: sessionError } = await window.dbhsSupabase.auth.getSession();
  if (sessionError) return { ok: false, message: sessionError.message };

  const email = sessionData?.session?.user?.email;
  if (!email) return { ok: false, message: "No authenticated member session found." };

  const orderPayload = {
    member_email: email,
    subtotal_jmd: totals.subtotal,
    shipping_jmd: totals.shipping,
    total_jmd: totals.total,
    status: "new"
  };

  const { data: order, error: orderError } = await window.dbhsSupabase
    .from("merch_orders")
    .insert(orderPayload)
    .select("id")
    .single();

  if (orderError) return { ok: false, message: orderError.message };

  const itemPayload = entries.map(({ product, qty }) => ({
    order_id: order.id,
    product_name: product.name,
    product_code: product.code || null,
    quantity: qty,
    unit_price_jmd: Number(product.price || 0),
    line_total_jmd: Number(product.price || 0) * qty
  }));

  const { error: itemsError } = await window.dbhsSupabase
    .from("merch_order_items")
    .insert(itemPayload);

  if (itemsError) return { ok: false, message: itemsError.message };
  return { ok: true };
}

cartList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.getAttribute("data-id");
  const action = button.getAttribute("data-action");

  if (action === "decrease") changeQty(id, -1);
  if (action === "increase") changeQty(id, 1);
  if (action === "remove") removeItem(id);
});

clearCartBtn.addEventListener("click", () => {
  writeCart({});
  setStatus("Cart cleared.");
  render();
});

regionSelect.addEventListener("change", (event) => {
  storeRegion = event.target.value;
  localStorage.setItem("dbhs_store_region", storeRegion);
  render();
});

placeOrderBtn.addEventListener("click", async () => {
  const entries = getCartEntries();
  if (!entries.length) return;

  const totals = calculateTotals(entries);
  placeOrderBtn.disabled = true;
  setStatus("Placing order...");

  const result = await saveOrderToSupabase(entries, totals);
  if (!result.ok) {
    setStatus(`Checkout failed: ${result.message}`, true);
    placeOrderBtn.disabled = false;
    return;
  }

  writeCart({});
  setStatus("Order sent to DBHS Alumni Association store team.");
  render();
});

async function loadProductsFromSupabase() {
  if (!window.dbhsSupabase) return;

  const { data, error } = await window.dbhsSupabase
    .from("merch_products")
    .select("id,name,subtitle,category,code,price_jmd")
    .eq("active", true);

  if (error || !data || data.length === 0) return;

  productsData = data.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: p.subtitle || "Official alumni merchandise",
    category: p.category || "General",
    code: p.code || "DBHS",
    price: Number(p.price_jmd || 0)
  }));

  render();
}

render();
loadProductsFromSupabase();
