const app = document.getElementById("app");
const supabase = window.dbhsSupabase;

if (!supabase) {
  app.innerHTML = `<main style="padding:18px">Supabase is not configured. Update <code>supabase-config.js</code>.</main>`;
  throw new Error("Supabase config missing");
}

function money(v) {
  return `JMD $${Number(v || 0).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let state = {
  userEmail: "",
  products: [],
  ordersToday: [],
  sales7d: []
};

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
      <main style="padding:18px;font-family:Manrope,sans-serif">
        <h2>Admin Access Required</h2>
        <p>Your account (<strong>${escapeHtml(email)}</strong>) is not in <code>admin_users</code>.</p>
        <p>Add this email to <code>admin_users</code> in Supabase.</p>
        <a href="./Merch.html">Back to Store</a>
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
    .select("id,name,category,price_jmd,stock_qty,active,code,subtitle")
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.products = data || [];
}

async function loadOrdersToday() {
  const { data, error } = await supabase
    .from("merch_orders")
    .select("id,member_email,total_jmd,status,created_at")
    .gte("created_at", startOfTodayIso())
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.ordersToday = data || [];
}

async function loadSales7d() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
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

  state.sales7d = [...map.values()];
}

function render() {
  const todaySales = state.ordersToday.reduce((sum, o) => sum + Number(o.total_jmd || 0), 0);
  const todayOrders = state.ordersToday.length;
  const todayCustomers = new Set(state.ordersToday.map((o) => o.member_email)).size;
  const activeProducts = state.products.filter((p) => p.active).length;

  const maxBar = Math.max(1, ...state.sales7d);
  const bars = state.sales7d
    .map((v) => {
      const h = Math.max(8, Math.round((Number(v) / maxBar) * 100));
      return `<div style="height:${h}%" title="${money(v)}"></div>`;
    })
    .join("");

  const productsRows = state.products
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${money(p.price_jmd)}</td>
        <td>${escapeHtml(p.stock_qty)}</td>
        <td>${p.active ? "Active" : "Hidden"}</td>
        <td>
          <div class="row-actions">
            <button data-edit="${p.id}">Edit</button>
            <button data-toggle="${p.id}">${p.active ? "Hide" : "Show"}</button>
            <button data-delete="${p.id}">Delete</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  const ordersRows = state.ordersToday
    .map(
      (o) => `
      <tr>
        <td>${new Date(o.created_at).toLocaleTimeString()}</td>
        <td>${escapeHtml(o.member_email)}</td>
        <td>${money(o.total_jmd)}</td>
        <td>
          <select data-status="${o.id}">
            ${["new", "processing", "completed", "cancelled"]
              .map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </td>
      </tr>
    `
    )
    .join("");

  app.innerHTML = `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="./Assests/image-removebg-preview%20(4).png" alt="DBHS logo">
          <span>DBHS Admin</span>
        </div>
        <div class="menu">
          <button class="active">Dashboard</button>
          <button disabled>Products</button>
          <button disabled>Orders</button>
          <button disabled>Analytics</button>
        </div>
        <button id="logoutBtn" class="logout">Logout</button>
      </aside>

      <section class="main">
        <div class="topbar">
          <div>
            <h1>Dashboard</h1>
            <div class="meta">${escapeHtml(state.userEmail)}</div>
          </div>
          <a href="./Merch.html" class="logout">Open Store</a>
        </div>

        <div id="status" class="status"></div>

        <div class="grid-4">
          <article class="stat"><h3>Today Sales</h3><p>${money(todaySales)}</p></article>
          <article class="stat"><h3>Today Orders</h3><p>${todayOrders}</p></article>
          <article class="stat"><h3>Today Customers</h3><p>${todayCustomers}</p></article>
          <article class="stat"><h3>Active Products</h3><p>${activeProducts}</p></article>
        </div>

        <section class="panel">
          <h2>Sales Overview (Last 7 Days)</h2>
          <div class="chart"><div class="chart-bars">${bars}</div></div>
        </section>

        <section class="panel">
          <h2>Add Product</h2>
          <form id="addProductForm" class="form-grid">
            <input name="name" placeholder="Name" required>
            <input name="subtitle" placeholder="Subtitle" required>
            <input name="code" placeholder="Code" required>
            <input name="category" placeholder="Category" required>
            <input name="price_jmd" type="number" min="0" step="0.01" placeholder="Price (JMD)" required>
            <input name="stock_qty" type="number" min="0" step="1" placeholder="Stock Qty" required>
            <button type="submit">Create Product</button>
          </form>
        </section>

        <section class="panel">
          <h2>Manage Products</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>${productsRows || "<tr><td colspan='6'>No products yet.</td></tr>"}</tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <h2>Today's Orders</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Member Email</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>${ordersRows || "<tr><td colspan='4'>No orders today.</td></tr>"}</tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  `;

  bindEvents();
}

function setStatus(message, type = "success") {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`;
}

async function reload() {
  await Promise.all([loadProducts(), loadOrdersToday(), loadSales7d()]);
  render();
}

function bindEvents() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      localStorage.removeItem("dbhs_auth_session");
      sessionStorage.removeItem("dbhs_auth_session");
      window.location.href = "./Auth.html";
    });
  }

  const addForm = document.getElementById("addProductForm");
  if (addForm) {
    addForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(addForm);
      const payload = {
        name: String(fd.get("name") || "").trim(),
        subtitle: String(fd.get("subtitle") || "").trim(),
        code: String(fd.get("code") || "").trim(),
        category: String(fd.get("category") || "").trim(),
        price_jmd: Number(fd.get("price_jmd") || 0),
        stock_qty: Number(fd.get("stock_qty") || 0),
        active: true
      };

      const { error } = await supabase.from("merch_products").insert(payload);
      if (error) {
        setStatus(error.message, "error");
        return;
      }

      addForm.reset();
      setStatus("Product created.", "success");
      await reload();
    });
  }

  document.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete");
      if (!confirm("Delete this product?")) return;
      const { error } = await supabase.from("merch_products").delete().eq("id", id);
      if (error) return setStatus(error.message, "error");
      setStatus("Product deleted.", "success");
      await reload();
    });
  });

  document.querySelectorAll("button[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle");
      const p = state.products.find((x) => x.id === id);
      if (!p) return;
      const { error } = await supabase.from("merch_products").update({ active: !p.active }).eq("id", id);
      if (error) return setStatus(error.message, "error");
      setStatus("Product status updated.", "success");
      await reload();
    });
  });

  document.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const p = state.products.find((x) => x.id === id);
      if (!p) return;

      const nextPrice = prompt("New price (JMD)", p.price_jmd);
      if (nextPrice === null) return;
      const nextStock = prompt("New stock qty", p.stock_qty);
      if (nextStock === null) return;

      const { error } = await supabase
        .from("merch_products")
        .update({ price_jmd: Number(nextPrice), stock_qty: Number(nextStock) })
        .eq("id", id);

      if (error) return setStatus(error.message, "error");
      setStatus("Product updated.", "success");
      await reload();
    });
  });

  document.querySelectorAll("select[data-status]").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const id = sel.getAttribute("data-status");
      const status = sel.value;
      const { error } = await supabase.from("merch_orders").update({ status }).eq("id", id);
      if (error) return setStatus(error.message, "error");
      setStatus("Order status updated.", "success");
    });
  });
}

(async function init() {
  try {
    const allowed = await requireAdmin();
    if (!allowed) return;
    await reload();
  } catch (error) {
    app.innerHTML = `<main style="padding:18px">${escapeHtml(error.message || "Admin dashboard failed to load")}</main>`;
  }
})();
