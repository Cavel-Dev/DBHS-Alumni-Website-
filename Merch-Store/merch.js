const { useEffect, useMemo, useState } = React;

const STORE_REGIONS = {
  jamaica: { label: "Jamaica", symbol: "JMD $", locale: "en-JM", fx: 1 },
  us: { label: "United States", symbol: "US $", locale: "en-US", fx: 1 / 155 },
  uk: { label: "United Kingdom", symbol: "GBP ", locale: "en-GB", fx: 1 / 198 }
};

const REGION_SUPPLIERS = {
  jamaica: "Jamaica supplier network",
  us: "United States supplier network",
  uk: "United Kingdom supplier network"
};

function formatCurrency(value, region) {
  const config = STORE_REGIONS[region] || STORE_REGIONS.jamaica;
  const converted = Number(value || 0) * config.fx;
  const amount = converted.toLocaleString(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${config.symbol}${amount}`;
}

function detectRegion() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const locale = navigator.language || "";
  const localeCountry = locale.includes("-") ? locale.split("-").pop().toUpperCase() : "";

  if (localeCountry === "JM" || timezone.includes("Jamaica")) return "jamaica";
  if (localeCountry === "GB" || timezone.includes("London")) return "uk";
  if (localeCountry === "US") return "us";
  if (timezone.startsWith("America/") && !timezone.includes("Jamaica")) return "us";
  return "jamaica";
}

function regionFromCoords(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  // Jamaica bounds
  if (lat >= 17.5 && lat <= 18.7 && lon >= -78.5 && lon <= -76.1) return "jamaica";
  // UK bounds
  if (lat >= 49.8 && lat <= 60.9 && lon >= -8.7 && lon <= 1.8) return "uk";
  // US bounds (contiguous + AK + HI)
  if (lat >= 18.8 && lat <= 71.6 && lon >= -171.8 && lon <= -66.9) return "us";
  return null;
}

function getRegionFromGeolocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const mapped = regionFromCoords(position.coords.latitude, position.coords.longitude);
        resolve(mapped);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 3600000 }
    );
  });
}

function App() {
  const [productsData, setProductsData] = useState(PRODUCTS);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [sortBy, setSortBy] = useState("new");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [regionNotice, setRegionNotice] = useState("");
  const [logoSrc, setLogoSrc] = useState("./Assests/image-removebg-preview%20(4).png");
  const [wishlist, setWishlist] = useState([]);
  const [storeRegion, setStoreRegion] = useState(localStorage.getItem("dbhs_store_region") || "jamaica");

  const CATEGORIES = useMemo(
    () => ["All Categories", ...new Set(productsData.map((item) => item.category))],
    [productsData]
  );

  useEffect(() => {
    async function loadProductsFromSupabase() {
      if (!window.dbhsSupabase) return;
      const { data, error } = await window.dbhsSupabase
        .from("merch_products")
        .select("id,name,subtitle,category,code,price_jmd")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) return;
      setProductsData(
        data.map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.subtitle || "Official alumni merchandise",
          category: p.category || "General",
          code: p.code || "DBHS",
          price: Number(p.price_jmd || 0),
          rating: 4.7,
          reviewCount: 24
        }))
      );
    }
    loadProductsFromSupabase();
  }, []);

  useEffect(() => {
    localStorage.setItem("dbhs_store_region", storeRegion);
  }, [storeRegion]);

  useEffect(() => {
    let cancelled = false;

    async function autoDetectRegion() {
      const hasManualRegion = localStorage.getItem("dbhs_store_region_manual") === "1";
      if (hasManualRegion) return;

      const geoDetected = await getRegionFromGeolocation();
      if (cancelled) return;

      const detected = geoDetected || detectRegion();
      if (!detected || detected === storeRegion) return;

      setStoreRegion(detected);
      setRegionNotice(
        `Region detected: ${STORE_REGIONS[detected].label}. We switched your store version automatically. Suppliers, stock, delivery times, and pricing vary by region.`
      );
    }

    autoDetectRegion();
    return () => {
      cancelled = true;
    };
  }, [storeRegion]);

  const filteredProducts = useMemo(() => {
    let list = productsData.filter((item) => {
      const categoryMatch = category === "All Categories" || item.category === category;
      const queryMatch = item.name.toLowerCase().includes(query.toLowerCase().trim());
      return categoryMatch && queryMatch;
    });

    if (sortBy === "price-low") list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") list = [...list].sort((a, b) => b.price - a.price);
    if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "top-rated") list = [...list].sort((a, b) => b.rating - a.rating);

    return list;
  }, [query, category, sortBy, productsData]);

  const topPicks = useMemo(() => [...productsData].slice(0, 5), [productsData]);

  const cartEntries = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = productsData.find((item) => String(item.id) === String(id));
          return product ? { product, qty } : null;
        })
        .filter(Boolean),
    [cart, productsData]
  );

  const cartCount = useMemo(() => cartEntries.reduce((sum, item) => sum + item.qty, 0), [cartEntries]);
  const subtotal = useMemo(() => cartEntries.reduce((sum, item) => sum + item.product.price * item.qty, 0), [cartEntries]);
  const shipping = subtotal > 0 ? 950 : 0;
  const total = subtotal + shipping;

  function addToCart(id) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    setNotice("Added to cart.");
  }

  function changeQty(id, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const amount = (next[id] || 0) + delta;
      if (amount <= 0) delete next[id];
      else next[id] = amount;
      return next;
    });
  }

  async function checkout() {
    if (!cartCount) return;
    const result = await saveOrderToSupabase();
    if (!result.ok) {
      setNotice(`Checkout failed: ${result.message}`);
      return;
    }
    setCart({});
    setNotice("Order sent to DBHS Alumni Association store team.");
    setCartOpen(false);
  }

  async function saveOrderToSupabase() {
    if (!window.dbhsSupabase || cartEntries.length === 0) return { ok: true };

    const { data: sessionData, error: sessionError } = await window.dbhsSupabase.auth.getSession();
    if (sessionError) return { ok: false, message: sessionError.message };

    const email = sessionData?.session?.user?.email;
    if (!email) return { ok: false, message: "No authenticated member session found." };

    const orderPayload = {
      member_email: email,
      subtotal_jmd: subtotal,
      shipping_jmd: shipping,
      total_jmd: total,
      status: "new"
    };

    const { data: order, error: orderError } = await window.dbhsSupabase
      .from("merch_orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderError) return { ok: false, message: orderError.message };

    const itemPayload = cartEntries.map(({ product, qty }) => ({
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

  async function logout() {
    if (window.dbhsSupabase) await window.dbhsSupabase.auth.signOut();
    localStorage.removeItem("dbhs_auth_session");
    sessionStorage.removeItem("dbhs_auth_session");
    window.location.href = "./Auth.html";
  }

  function onRegionChange(nextRegion) {
    localStorage.setItem("dbhs_store_region_manual", "1");
    setStoreRegion(nextRegion);
    setRegionNotice(
      `Store version changed to ${STORE_REGIONS[nextRegion].label}. Orders are fulfilled by region-specific suppliers.`
    );
  }

  function openProduct(id) {
    if (!Number.isFinite(Number(id))) {
      setNotice("Product details page is currently available for core catalog items.");
      return;
    }
    window.location.href = `./Product.html?id=${id}`;
  }

  function toggleWishlist(id) {
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  return (
    <>
      <header className="site-header">
        <div className="wrap nav-row">
          <a href="#" className="brand" aria-label="DBHS Alumni Merch">
            <span className="brand-mark">
              <img
                src={logoSrc}
                alt="DBHS Alumni Association logo"
                className="brand-logo"
                onError={() => {
                  if (logoSrc !== "./Assests/image.png") setLogoSrc("./Assests/image.png");
                }}
              />
            </span>
            <span className="brand-name">DBHS Alumni Merch</span>
          </a>

          <nav className="top-nav" aria-label="Main navigation">
            <a href="#shop">Shop</a>
            <a href="#featured">Featured</a>
            <a href="#categories">Categories</a>
            <a href="#support">Support</a>
            <a href="./Admin.html">Admin</a>
          </nav>

          <div className="actions-right">
            <div className="header-search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for product, category..."
                aria-label="Search products"
              />
            </div>

            <label className="region-switch" title="Select store version">
              <span>Version</span>
              <select value={storeRegion} onChange={(event) => onRegionChange(event.target.value)}>
                <option value="jamaica">Jamaica</option>
                <option value="us">US</option>
                <option value="uk">UK</option>
              </select>
            </label>

            <button className="icon-btn" type="button" onClick={() => setCartOpen(true)} aria-label="Open cart">
              Cart {cartCount ? `(${cartCount})` : ""}
            </button>
            <button className="icon-btn ghost" type="button" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="wrap page-content" id="shop">
        <section className="hero-card">
          <div className="hero-content">
            <p className="eyebrow">Discovery Bay High School Alumni Association</p>
            <h1>Official Merch Store For Verified Members</h1>
            <p className="hero-copy">
              Shop premium alumni gear, support chapter initiatives, and represent the legacy in style.
            </p>
            <div className="hero-cta-row">
              <button className="cta-main" type="button" onClick={() => window.scrollTo({ top: 720, behavior: "smooth" })}>Shop Collection</button>
              <button className="cta-sub" type="button" onClick={() => setCartOpen(true)}>Checkout</button>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-logo-wrap"><img src={logoSrc} alt="" /></div>
          </div>
        </section>

        <section className="strip-search" id="featured">
          <div className="strip-left">
            <strong>Store version: {STORE_REGIONS[storeRegion].label}</strong>
            <span>{filteredProducts.length} products available</span>
          </div>
          <div className="strip-right">
            <label>
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="new">New In</option>
                <option value="top-rated">Top Rated</option>
                <option value="price-low">Price Low to High</option>
                <option value="price-high">Price High to Low</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
        </section>

        <section className="supplier-note" aria-live="polite">
          <strong>Supplier region: {REGION_SUPPLIERS[storeRegion]}</strong>
          <span>
            Different suppliers serve different regions. That means availability, shipping speed, and some pricing can differ by Jamaica, US, and UK.
          </span>
          {regionNotice && <em>{regionNotice}</em>}
        </section>

        <section className="h-scroll-section">
          <h2>Top Picks This Week</h2>
          <div className="h-scroll-row">
            {topPicks.map((item) => (
              <a key={item.id} href={`./Product.html?id=${item.id}`} className="mini-card">
                <div className="mini-media">{item.code}</div>
                <h3>{item.name}</h3>
                <p>{formatCurrency(item.price, storeRegion)}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="category-row" id="categories">
          {CATEGORIES.slice(1).map((cat) => (
            <button key={cat} type="button" className={`cat-chip ${category === cat ? "active" : ""}`} onClick={() => setCategory(cat)}>
              {cat}
            </button>
          ))}
          <button type="button" className={`cat-chip ${category === "All Categories" ? "active" : ""}`} onClick={() => setCategory("All Categories")}>
            View All
          </button>
        </section>

        <section className="product-grid" aria-live="polite">
          {filteredProducts.map((item) => {
            const lowStock = 4 + ((item.id * 3) % 10);
            const wished = wishlist.includes(item.id);

            return (
              <article
                className="product-card"
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => openProduct(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProduct(item.id);
                  }
                }}
              >
                <div className="product-image">
                  <button
                    className={`wish-btn ${wished ? "active" : ""}`}
                    type="button"
                    aria-label="Toggle wishlist"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleWishlist(item.id);
                    }}
                  >
                    {wished ? "Saved" : "Save"}
                  </button>
                  <div className="product-badge">{item.code}</div>
                </div>

                <div className="product-info">
                  <p className="stock">Only {lowStock} left in stock</p>
                  <h3>{item.name}</h3>
                  <p className="sub">{item.subtitle}</p>
                  <div className="rating-row">Rating {item.rating.toFixed(1)} | {item.reviewCount} reviews</div>
                  <div className="card-foot">
                    <strong>{formatCurrency(item.price, storeRegion)}</strong>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        addToCart(item.id);
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {wishlist.length > 0 && (
          <section className="h-scroll-section" id="wishlist">
            <h2>Your Wishlist</h2>
            <div className="h-scroll-row">
              {productsData.filter((item) => wishlist.includes(item.id)).map((item) => (
                <a key={item.id} href={`./Product.html?id=${item.id}`} className="mini-card">
                  <div className="mini-media">{item.code}</div>
                  <h3>{item.name}</h3>
                  <p>{formatCurrency(item.price, storeRegion)}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {notice && <p className="notice">{notice}</p>}
      </main>

      <div className={`cart-overlay ${cartOpen ? "open" : ""}`} onClick={() => setCartOpen(false)}>
        <aside className="cart-drawer" onClick={(event) => event.stopPropagation()} aria-label="Shopping cart">
          <div className="drawer-head">
            <h2>Your Cart</h2>
            <button type="button" onClick={() => setCartOpen(false)}>Close</button>
          </div>

          <div className="drawer-body">
            {!cartEntries.length && <p className="empty">No items added yet.</p>}
            {cartEntries.map(({ product, qty }) => (
              <div className="cart-item" key={product.id}>
                <div>
                  <h4>{product.name}</h4>
                  <p>{formatCurrency(product.price * qty, storeRegion)}</p>
                </div>
                <div className="qty-controls">
                  <button type="button" onClick={() => changeQty(product.id, -1)}>-</button>
                  <span>{qty}</span>
                  <button type="button" onClick={() => changeQty(product.id, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="drawer-foot" id="support">
            <div className="line"><span>Subtotal</span><span>{formatCurrency(subtotal, storeRegion)}</span></div>
            <div className="line"><span>Shipping</span><span>{formatCurrency(shipping, storeRegion)}</span></div>
            <div className="line total"><span>Total</span><span>{formatCurrency(total, storeRegion)}</span></div>
            <button className="checkout-btn" type="button" disabled={!cartCount} onClick={checkout}>
              Proceed to Checkout
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
