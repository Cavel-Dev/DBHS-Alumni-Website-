const app = document.getElementById("app");
const supabase = window.dbhsSupabase;

if (!supabase) {
  app.innerHTML = `<main style="padding:18px">Supabase is not configured. Update <code>supabase-config.js</code>.</main>`;
  throw new Error("Supabase config missing");
}

const CATEGORY_OPTIONS = [
  "Apparel",
  "Accessories",
  "Drinkware",
  "Footwear",
  "Collectibles",
  "General"
];

let state = {
  userEmail: "",
  view: "dashboard",
  products: [],
  orders: [],
  sales7d: [],
  productSearch: "",
  productCategory: "all",
  productActive: "all",
  orderStatusFilter: "all",
  editingProductId: null,
  statusMessage: "",
  statusType: "success"
};

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(v) {
  return `JMD $${Number(v || 0).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function setStatus(message, type = "success") {
  state.statusMessage = message;
  state.statusType = type;
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`;
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toCsv(arr) {
  return Array.isArray(arr) ? arr.join(", ") : "";
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requireAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData?.session?.user?.email;
  if (!email) {
    window.location.href = "./Auth.html";
    return false;
  }

  const { data: adminRow, error } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (error || !adminRow) {
    app.innerHTML = `
      <main style="padding:20px;font-family:Manrope,sans-serif">
        <h2>Admin access required</h2>
        <p>${escapeHtml(email)} is not in <code>admin_users</code>.</p>
        <p>Add your email in Supabase and refresh this page.</p>
        <a href="./Merch.html">Back to store</a>
      </main>
    `;
    return false;
  }

  state.userEmail = email;
  return true;
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("merch_products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.products = data || [];
}

async function loadOrders() {
  const { data, error } = await supabase
    .from("merch_orders")
    .select("id,member_email,total_jmd,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  state.orders = data || [];
}

async function loadSales7d() {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  const start = new Date(days[0]);
  const end = new Date(days[days.length - 1]);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("merch_orders")
    .select("total_jmd,created_at")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) throw error;

  const map = new Map(days.map((d) => [d.toISOString().slice(0, 10), 0]));
  for (const row of data || []) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + Number(row.total_jmd || 0));
  }

  state.sales7d = [...map.entries()].map(([dateKey, total]) => ({
    dateKey,
    total
  }));
}

async function reload() {
  await Promise.all([loadProducts(), loadOrders(), loadSales7d()]);
  render();
}

function renderSidebar() {
  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "products", label: "Products" },
    { key: "orders", label: "Orders" }
  ];

  return `
    <aside class="sidebar">
      <div class="brand">
        <img src="./Assests/image-removebg-preview%20(4).png" alt="DBHS logo">
        <div>
          <strong>DBHS Admin</strong>
          <span>Merch control center</span>
        </div>
      </div>

      <nav class="side-nav">
        ${navItems
          .map(
            (item) =>
              `<button class="nav-btn ${state.view === item.key ? "active" : ""}" data-nav="${item.key}">${item.label}</button>`
          )
          .join("")}
      </nav>

      <div class="sidebar-foot">
        <div class="chip">${escapeHtml(state.userEmail)}</div>
        <button class="ghost-btn" id="logoutBtn" type="button">Logout</button>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div>
        <h1>${state.view === "dashboard" ? "Dashboard" : state.view === "products" ? "Products" : "Orders"}</h1>
        <p>Manage products, stock, and order flow from one place.</p>
      </div>
      <div class="top-actions">
        <a href="./Merch.html" class="ghost-link">Open Store</a>
        <button id="refreshBtn" class="ghost-btn" type="button">Refresh</button>
      </div>
    </header>
  `;
}

function renderDashboard() {
  const todayIso = startOfTodayIso();
  const todayOrders = state.orders.filter((o) => o.created_at >= todayIso);
  const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total_jmd || 0), 0);
  const todayCustomers = new Set(todayOrders.map((o) => o.member_email)).size;
  const activeProducts = state.products.filter((p) => p.active).length;
  const lowStock = state.products.filter((p) => Number(p.stock_qty || 0) <= 5).slice(0, 5);

  const maxBar = Math.max(1, ...state.sales7d.map((x) => x.total));
  const bars = state.sales7d
    .map((entry) => {
      const height = Math.max(8, Math.round((entry.total / maxBar) * 100));
      const day = new Date(entry.dateKey).toLocaleDateString("en-JM", { weekday: "short" });
      return `<div class="bar-wrap"><div class="bar" style="height:${height}%" title="${money(entry.total)}"></div><span>${day}</span></div>`;
    })
    .join("");

  const lowStockRows = lowStock.length
    ? lowStock
        .map(
          (p) => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category || "General")}</td><td>${Number(p.stock_qty || 0)}</td></tr>`
        )
        .join("")
    : "<tr><td colspan='3'>No low-stock products.</td></tr>";

  return `
    <section class="stats-grid">
      <article class="stat-card"><h3>Today Sales</h3><p>${money(todaySales)}</p></article>
      <article class="stat-card"><h3>Today Orders</h3><p>${todayOrders.length}</p></article>
      <article class="stat-card"><h3>Customers Today</h3><p>${todayCustomers}</p></article>
      <article class="stat-card"><h3>Active Products</h3><p>${activeProducts}</p></article>
    </section>

    <section class="card chart-card">
      <div class="card-head"><h2>Sales Last 7 Days</h2></div>
      <div class="bars">${bars}</div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Low Stock Watchlist</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Stock</th></tr></thead>
          <tbody>${lowStockRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function filteredProducts() {
  return state.products.filter((p) => {
    const q = state.productSearch.trim().toLowerCase();
    const matchesText = !q || String(p.name || "").toLowerCase().includes(q) || String(p.code || "").toLowerCase().includes(q);
    const matchesCategory = state.productCategory === "all" || String(p.category || "General") === state.productCategory;
    const matchesActive =
      state.productActive === "all" ||
      (state.productActive === "active" && !!p.active) ||
      (state.productActive === "hidden" && !p.active);
    return matchesText && matchesCategory && matchesActive;
  });
}

function renderProducts() {
  const categories = [...new Set(state.products.map((p) => p.category || "General"))].filter(Boolean).sort();
  const rows = filteredProducts()
    .map(
      (p) => `
      <tr>
        <td>
          <div class="prod-name">${escapeHtml(p.name)}</div>
          <div class="prod-sub">${escapeHtml(p.code || "DBHS")} - ${escapeHtml(p.subtitle || "")}</div>
        </td>
        <td>${escapeHtml(p.category || "General")}</td>
        <td>${money(p.price_jmd)}</td>
        <td>${Number(p.stock_qty || 0)}</td>
        <td><span class="badge ${p.active ? "ok" : "warn"}">${p.active ? "Active" : "Hidden"}</span></td>
        <td>
          <div class="row-actions">
            <button data-edit="${p.id}" class="mini-btn" type="button">Edit</button>
            <button data-toggle="${p.id}" class="mini-btn" type="button">${p.active ? "Hide" : "Show"}</button>
            <button data-delete="${p.id}" class="mini-btn danger" type="button">Delete</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <section class="card">
      <div class="card-head"><h2>Create Product</h2></div>
      <form id="addProductForm" class="product-form">
        <label>Name<input name="name" required placeholder="Alumni Heritage Hoodie"></label>
        <label>Subtitle<input name="subtitle" required placeholder="Heavyweight cotton blend"></label>
        <label>Code<input name="code" required placeholder="AH"></label>
        <label>Category
          <select name="category" required>
            ${CATEGORY_OPTIONS.map((cat) => `<option value="${cat}">${cat}</option>`).join("")}
          </select>
        </label>
        <label>Price (JMD)<input name="price_jmd" type="number" min="0" step="0.01" required></label>
        <label>Stock Qty<input name="stock_qty" type="number" min="0" step="1" required></label>
        <label>Active
          <select name="active">
            <option value="true">Active</option>
            <option value="false">Hidden</option>
          </select>
        </label>
        <label>Sizes (comma separated)<input name="sizes_csv" placeholder="S, M, L, XL"></label>
        <label>Details (comma separated)<input name="details_csv" placeholder="Cotton blend, Embossed crest"></label>
        <label class="full">Description<textarea name="description" rows="3" placeholder="Premium alumni hoodie..."></textarea></label>
        <div class="full form-foot">
          <button type="submit" class="primary-btn">Create Product</button>
        </div>
      </form>
    </section>

    <section class="card">
      <div class="card-head card-head-spread">
        <h2>Manage Products</h2>
        <div class="filters">
          <input id="productSearch" value="${escapeHtml(state.productSearch)}" placeholder="Search name/code">
          <select id="productCategoryFilter">
            <option value="all">All categories</option>
            ${categories.map((cat) => `<option value="${escapeHtml(cat)}" ${state.productCategory === cat ? "selected" : ""}>${escapeHtml(cat)}</option>`).join("")}
          </select>
          <select id="productActiveFilter">
            <option value="all" ${state.productActive === "all" ? "selected" : ""}>All status</option>
            <option value="active" ${state.productActive === "active" ? "selected" : ""}>Active</option>
            <option value="hidden" ${state.productActive === "hidden" ? "selected" : ""}>Hidden</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || "<tr><td colspan='6'>No products found.</td></tr>"}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderOrders() {
  const rows = state.orders
    .filter((o) => state.orderStatusFilter === "all" || o.status === state.orderStatusFilter)
    .map(
      (o) => `
      <tr>
        <td>${new Date(o.created_at).toLocaleString()}</td>
        <td>${escapeHtml(o.member_email)}</td>
        <td>${money(o.total_jmd)}</td>
        <td>
          <select data-order-status="${o.id}">
            ${["new", "processing", "completed", "cancelled"]
              .map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <section class="card">
      <div class="card-head card-head-spread">
        <h2>Orders</h2>
        <div class="filters">
          <select id="orderStatusFilter">
            <option value="all" ${state.orderStatusFilter === "all" ? "selected" : ""}>All status</option>
            <option value="new" ${state.orderStatusFilter === "new" ? "selected" : ""}>New</option>
            <option value="processing" ${state.orderStatusFilter === "processing" ? "selected" : ""}>Processing</option>
            <option value="completed" ${state.orderStatusFilter === "completed" ? "selected" : ""}>Completed</option>
            <option value="cancelled" ${state.orderStatusFilter === "cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Created</th><th>Member Email</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>${rows || "<tr><td colspan='4'>No orders found.</td></tr>"}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderEditModal() {
  if (!state.editingProductId) return "";
  const p = state.products.find((item) => String(item.id) === String(state.editingProductId));
  if (!p) return "";

  return `
    <div class="modal-overlay" id="editOverlay">
      <div class="modal">
        <div class="card-head card-head-spread">
          <h2>Edit Product</h2>
          <button type="button" class="ghost-btn" id="closeEditBtn">Close</button>
        </div>
        <form id="editProductForm" class="product-form">
          <input type="hidden" name="id" value="${p.id}">
          <label>Name<input name="name" required value="${escapeHtml(p.name || "")}"></label>
          <label>Subtitle<input name="subtitle" value="${escapeHtml(p.subtitle || "")}"></label>
          <label>Code<input name="code" value="${escapeHtml(p.code || "")}"></label>
          <label>Category
            <select name="category" required>
              ${CATEGORY_OPTIONS.map((cat) => `<option value="${cat}" ${String(p.category || "General") === cat ? "selected" : ""}>${cat}</option>`).join("")}
            </select>
          </label>
          <label>Price (JMD)<input name="price_jmd" type="number" min="0" step="0.01" value="${Number(p.price_jmd || 0)}"></label>
          <label>Stock Qty<input name="stock_qty" type="number" min="0" step="1" value="${Number(p.stock_qty || 0)}"></label>
          <label>Active
            <select name="active">
              <option value="true" ${p.active ? "selected" : ""}>Active</option>
              <option value="false" ${!p.active ? "selected" : ""}>Hidden</option>
            </select>
          </label>
          <label>Sizes (comma separated)<input name="sizes_csv" value="${escapeHtml(toCsv(p.sizes))}"></label>
          <label>Details (comma separated)<input name="details_csv" value="${escapeHtml(toCsv(p.details))}"></label>
          <label class="full">Description<textarea name="description" rows="3">${escapeHtml(p.description || "")}</textarea></label>
          <div class="full form-foot">
            <button type="submit" class="primary-btn">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderMainContent() {
  if (state.view === "products") return renderProducts();
  if (state.view === "orders") return renderOrders();
  return renderDashboard();
}

function render() {
  app.innerHTML = `
    <div class="admin-shell">
      ${renderSidebar()}
      <section class="main">
        ${renderTopbar()}
        <div id="status" class="status ${state.statusType}">${escapeHtml(state.statusMessage)}</div>
        ${renderMainContent()}
      </section>
    </div>
    ${renderEditModal()}
  `;
  bindEvents();
}

async function createProduct(fd) {
  const payload = {
    name: String(fd.get("name") || "").trim(),
    subtitle: String(fd.get("subtitle") || "").trim(),
    code: String(fd.get("code") || "").trim().toUpperCase(),
    category: String(fd.get("category") || "General").trim() || "General",
    price_jmd: Number(fd.get("price_jmd") || 0),
    stock_qty: Number(fd.get("stock_qty") || 0),
    active: String(fd.get("active") || "true") === "true"
  };

  const description = String(fd.get("description") || "").trim();
  const sizes = parseCsv(fd.get("sizes_csv"));
  const details = parseCsv(fd.get("details_csv"));

  const { data, error } = await supabase.from("merch_products").insert(payload).select("id").single();
  if (error) {
    setStatus(`Create failed: ${error.message}`, "error");
    return false;
  }

  const optional = {};
  if (description) optional.description = description;
  if (sizes.length) optional.sizes = sizes;
  if (details.length) optional.details = details;

  if (Object.keys(optional).length) {
    const { error: optionalError } = await supabase.from("merch_products").update(optional).eq("id", data.id);
    if (optionalError) {
      setStatus(`Product created, but optional fields were not saved: ${optionalError.message}`, "error");
      await reload();
      return true;
    }
  }

  setStatus("Product created successfully.", "success");
  await reload();
  return true;
}

async function updateProduct(fd) {
  const id = fd.get("id");
  const payload = {
    name: String(fd.get("name") || "").trim(),
    subtitle: String(fd.get("subtitle") || "").trim(),
    code: String(fd.get("code") || "").trim().toUpperCase(),
    category: String(fd.get("category") || "General").trim() || "General",
    price_jmd: Number(fd.get("price_jmd") || 0),
    stock_qty: Number(fd.get("stock_qty") || 0),
    active: String(fd.get("active") || "true") === "true"
  };

  const description = String(fd.get("description") || "").trim();
  const sizes = parseCsv(fd.get("sizes_csv"));
  const details = parseCsv(fd.get("details_csv"));

  const { error } = await supabase.from("merch_products").update(payload).eq("id", id);
  if (error) {
    setStatus(`Update failed: ${error.message}`, "error");
    return;
  }

  const optional = {
    description,
    sizes,
    details
  };

  const { error: optionalError } = await supabase.from("merch_products").update(optional).eq("id", id);
  if (optionalError) {
    setStatus(`Core update saved, but optional fields failed: ${optionalError.message}`, "error");
    state.editingProductId = null;
    await reload();
    return;
  }

  state.editingProductId = null;
  setStatus("Product updated.", "success");
  await reload();
}

function bindEvents() {
  document.querySelectorAll("button[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = btn.getAttribute("data-nav");
      render();
    });
  });

  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      setStatus("Refreshing data...", "success");
      await reload();
      setStatus("Data refreshed.", "success");
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      localStorage.removeItem("dbhs_auth_session");
      sessionStorage.removeItem("dbhs_auth_session");
      window.location.href = "./Auth.html";
    });
  }

  const addProductForm = document.getElementById("addProductForm");
  if (addProductForm) {
    addProductForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const created = await createProduct(new FormData(addProductForm));
      if (created) addProductForm.reset();
    });
  }

  const productSearch = document.getElementById("productSearch");
  if (productSearch) {
    productSearch.addEventListener("input", () => {
      state.productSearch = productSearch.value;
      render();
    });
  }

  const productCategoryFilter = document.getElementById("productCategoryFilter");
  if (productCategoryFilter) {
    productCategoryFilter.addEventListener("change", () => {
      state.productCategory = productCategoryFilter.value;
      render();
    });
  }

  const productActiveFilter = document.getElementById("productActiveFilter");
  if (productActiveFilter) {
    productActiveFilter.addEventListener("change", () => {
      state.productActive = productActiveFilter.value;
      render();
    });
  }

  document.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.editingProductId = btn.getAttribute("data-edit");
      render();
    });
  });

  document.querySelectorAll("button[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle");
      const product = state.products.find((p) => String(p.id) === String(id));
      if (!product) return;

      const { error } = await supabase.from("merch_products").update({ active: !product.active }).eq("id", id);
      if (error) {
        setStatus(`Status update failed: ${error.message}`, "error");
        return;
      }

      setStatus("Product visibility updated.", "success");
      await reload();
    });
  });

  document.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete");
      const product = state.products.find((p) => String(p.id) === String(id));
      if (!product) return;

      const ok = window.confirm(`Delete \"${product.name}\"? This cannot be undone.`);
      if (!ok) return;

      const { error } = await supabase.from("merch_products").delete().eq("id", id);
      if (error) {
        setStatus(`Delete failed: ${error.message}`, "error");
        return;
      }

      setStatus("Product deleted.", "success");
      await reload();
    });
  });

  const closeEditBtn = document.getElementById("closeEditBtn");
  if (closeEditBtn) {
    closeEditBtn.addEventListener("click", () => {
      state.editingProductId = null;
      render();
    });
  }

  const editOverlay = document.getElementById("editOverlay");
  if (editOverlay) {
    editOverlay.addEventListener("click", (event) => {
      if (event.target.id === "editOverlay") {
        state.editingProductId = null;
        render();
      }
    });
  }

  const editProductForm = document.getElementById("editProductForm");
  if (editProductForm) {
    editProductForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await updateProduct(new FormData(editProductForm));
    });
  }

  const orderStatusFilter = document.getElementById("orderStatusFilter");
  if (orderStatusFilter) {
    orderStatusFilter.addEventListener("change", () => {
      state.orderStatusFilter = orderStatusFilter.value;
      render();
    });
  }

  document.querySelectorAll("select[data-order-status]").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const id = sel.getAttribute("data-order-status");
      const status = sel.value;
      const { error } = await supabase.from("merch_orders").update({ status }).eq("id", id);
      if (error) {
        setStatus(`Order update failed: ${error.message}`, "error");
        return;
      }
      setStatus("Order status updated.", "success");
      await reload();
    });
  });
}

(async function init() {
  try {
    const allowed = await requireAdmin();
    if (!allowed) return;
    await reload();
  } catch (error) {
    app.innerHTML = `<main style="padding:18px">${escapeHtml(error.message || "Admin failed to load")}</main>`;
  }
})();
