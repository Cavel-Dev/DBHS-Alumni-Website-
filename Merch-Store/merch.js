const { useEffect, useMemo, useState } = React;

const STORE_REGIONS = {
  jamaica: { label: "Jamaica", symbol: "JMD $", locale: "en-JM", fx: 1 },
  us: { label: "United States", symbol: "US $", locale: "en-US", fx: 1 / 155 },
  uk: { label: "United Kingdom", symbol: "GBP ", locale: "en-GB", fx: 1 / 198 }
};
const FORCE_PLACEHOLDER_IMAGES = true;
const PRODUCT_SOURCE =
  (typeof PRODUCTS !== "undefined" && Array.isArray(PRODUCTS) && PRODUCTS) ||
  (Array.isArray(window.PRODUCTS) && window.PRODUCTS) ||
  [];

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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function scoreMatch(product, rawQuery) {
  const query = normalizeText(rawQuery);
  if (!query) return 1;

  const haystack = normalizeText(`${product.name} ${product.subtitle || ""} ${product.category || ""} ${product.code || ""}`);
  if (!haystack) return 0;

  let score = 0;
  if (haystack.includes(query)) score += 10;
  if (normalizeText(product.name).startsWith(query)) score += 4;

  const queryTokens = tokenize(query);
  const textTokens = tokenize(haystack);
  const textTokenSet = new Set(textTokens);

  queryTokens.forEach((token) => {
    if (textTokenSet.has(token)) {
      score += 3;
      return;
    }

    // Typos/near matches: accept partial token overlaps.
    const partial = textTokens.some((t) => t.startsWith(token) || token.startsWith(t) || t.includes(token) || token.includes(t));
    if (partial) score += 1.5;
  });

  return score;
}

function buildUnsplash(seed, query, width = 640, height = 480) {
  const photoIds = [
    "1529139574466-a303027c1d8b",
    "1483985988355-763728e1935b",
    "1464863979621-258859e62245",
    "1503341504253-dff4815485f1",
    "1496747611176-843222e1e57c",
    "1521572267360-ee0c2909d518",
    "1487412720507-e7ab37603c6f",
    "1515886657613-9f3515b0c78f"
  ];
  const hash = String(seed || "0").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const id = photoIds[hash % photoIds.length];
  const safeQuery = encodeURIComponent(query || "fashion model person wearing hoodie t-shirt streetwear");
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80&sat=-5&blend=001a33&blend-alpha=10&query=${safeQuery}`;
}

function productImage(product, idx = 1) {
  const q = `${product.category || "apparel"} ${product.name || "merch"} model wearing hoodie t-shirt outfit streetwear`;
  return buildUnsplash(`${product.id}-${idx}`, q, 640, 520);
}

function displayImage(product, idx = 1) {
  if (!FORCE_PLACEHOLDER_IMAGES && product.image_url) return product.image_url;
  return productImage(product, idx);
}

function App() {
  const [productsData, setProductsData] = useState(PRODUCT_SOURCE);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("dbhs_merch_cart");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [logoSrc, setLogoSrc] = useState("./Assests/image-removebg-preview%20(4).png");
  const [storeRegion, setStoreRegion] = useState(localStorage.getItem("dbhs_store_region") || "jamaica");
  const [newsletterEmail, setNewsletterEmail] = useState("");

  const categories = useMemo(() => {
    const c = [...new Set(productsData.map((item) => item.category || "General"))];
    return ["All", ...c];
  }, [productsData]);

  useEffect(() => {
    async function loadProductsFromSupabase() {
      if (!window.dbhsSupabase) return;
      const { data, error } = await window.dbhsSupabase
        .from("merch_products")
        .select("*")
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
          rating: Number(p.rating || 4.7),
          reviewCount: Number(p.review_count || 24),
          image_url: p.image_url || null
        }))
      );
    }
    loadProductsFromSupabase();
  }, []);

  useEffect(() => {
    localStorage.setItem("dbhs_store_region", storeRegion);
  }, [storeRegion]);

  useEffect(() => {
    localStorage.setItem("dbhs_merch_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const hasManualRegion = localStorage.getItem("dbhs_store_region_manual") === "1";
    if (!hasManualRegion) setStoreRegion(detectRegion());
  }, []);

  const filteredProducts = useMemo(() => {
    const baseByCategory = productsData.filter((item) => activeCategory === "All" || item.category === activeCategory);
    const list = baseByCategory
      .map((item) => ({ item, score: scoreMatch(item, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);

    if (list.length) return list;

    // If category scope returns nothing, widen to all products for closest placeholders.
    if (query.trim()) {
      const wide = productsData
        .map((item) => ({ item, score: scoreMatch(item, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item);
      if (wide.length) return wide;
    }

    // Absolute fallback: show all products instead of empty UI.
    return [...productsData].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }, [activeCategory, query, productsData]);

  const exactMatchesCount = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return filteredProducts.length;
    return filteredProducts.filter((item) => normalizeText(item.name).includes(q)).length;
  }, [query, filteredProducts]);

  const usingClosestMatches = query.trim().length > 0 && exactMatchesCount === 0 && filteredProducts.length > 0;

  const heroProducts = useMemo(() => filteredProducts.slice(0, 6), [filteredProducts]);
  const featuredProducts = useMemo(() => filteredProducts.slice(0, 8), [filteredProducts]);
  const trendingProducts = useMemo(() => filteredProducts.slice(0, 4), [filteredProducts]);

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

  async function logout() {
    if (window.dbhsSupabase) await window.dbhsSupabase.auth.signOut();
    localStorage.removeItem("dbhs_auth_session");
    sessionStorage.removeItem("dbhs_auth_session");
    window.location.href = "./Auth.html";
  }

  function onRegionChange(nextRegion) {
    localStorage.setItem("dbhs_store_region_manual", "1");
    setStoreRegion(nextRegion);
  }

  function openProduct(id) {
    window.location.href = `./Product.html?id=${id}`;
  }

  function goToCheckout() {
    if (!cartCount) return;
    setCartOpen(false);
    window.location.href = "./Checkout.html";
  }

  function subscribeNewsletter() {
    const email = newsletterEmail.trim();
    if (!email || !email.includes("@")) {
      setNotice("Enter a valid email to subscribe.");
      return;
    }
    setNotice("Subscribed successfully. Alumni updates will be sent to your email.");
    setNewsletterEmail("");
  }

  const categoryChips = categories.slice(1, 7);

  return (
    <>
      <div className="wrap">
        <section className="neo-header" id="home">
          <div className="neo-toolbar">
            <a href="./Merch.html" className="brand" aria-label="DBHS Alumni Merch">
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
              <span className="brand-name">DBHSAA</span>
            </a>

            <div className="neo-search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
              />
              <button type="button" className="search-go" onClick={() => setNotice("Showing search results.")}>Go</button>
            </div>

            <div className="neo-actions">
              <label className="region-switch" title="Select store version">
                <span>Region</span>
                <select value={storeRegion} onChange={(event) => onRegionChange(event.target.value)}>
                  <option value="jamaica">Jamaica</option>
                  <option value="us">US</option>
                  <option value="uk">UK</option>
                </select>
              </label>
              <button className="icon-chip" type="button" onClick={() => setCartOpen(true)}>Cart {cartCount ? `(${cartCount})` : ""}</button>
              <button className="icon-chip heart" type="button" onClick={() => setNotice("Saved to wishlist.")}>Wishlist</button>
              <button className="user-chip" type="button" onClick={logout}>
                <span>DBHS Member</span>
                <img src={displayImage(heroProducts[2] || filteredProducts[2] || {}, 103)} alt="profile" />
              </button>
            </div>
          </div>

          <nav className="header-quick-links" aria-label="Quick links">
            <a href="#home">Home</a>
            <a href="#shop">Shop</a>
            <a href="#trending">Trending</a>
            <a href="./Checkout.html">Checkout</a>
            <a href="./Admin.html">Admin</a>
          </nav>

          <div className="neo-grid">
            <article className="neo-hero">
              <span className="hero-pill">DBHS Alumni Official Store</span>
              <h1>Legacy Inspired Alumni Merch.</h1>
              <div className="hero-meta">
                <strong>01</strong>
                <span>Alumni Essentials</span>
                <p>Premium DBHS alumni wear and accessories for reunions, chapters, and everyday pride.</p>
              </div>
              <button type="button" className="hero-cta" onClick={() => window.scrollTo({ top: 1180, behavior: "smooth" })}>View All Products</button>
              <div className="hero-social">
                <span>Follow us on:</span>
                <b>T</b><b>K</b><b>I</b><b>in</b>
              </div>
              <img src={displayImage(heroProducts[0] || filteredProducts[0] || {}, 101)} alt="featured product" />
            </article>

            <div className="neo-side">
              <article className="side-card">
                <h3>Popular Colors</h3>
                <div className="color-dots">
                  <span className="dot blue"></span>
                  <span className="dot amber"></span>
                  <span className="dot green"></span>
                  <span className="dot red"></span>
                  <span className="dot cyan"></span>
                </div>
              </article>

              <article className="side-card product">
                <h3>New Gen Collection</h3>
                <img src={displayImage(heroProducts[1] || filteredProducts[1] || {}, 102)} alt="new collection" />
              </article>

              <article className="side-card tall">
                <img src={displayImage(heroProducts[3] || filteredProducts[3] || {}, 104)} alt="headset style" />
                <h3>Light Grey Surface Headphone</h3>
                <p>Boosted with bass</p>
              </article>
            </div>
          </div>

          <div className="neo-bottom-cards">
            <article>
              <h4>More Products</h4>
              <p>{filteredProducts.length} plus items.</p>
              <div className="mini-thumbs">
                {filteredProducts.slice(0, 3).map((p, i) => (
                  <img key={`mini-${p.id}`} src={displayImage(p, 120 + i)} alt={p.name} />
                ))}
              </div>
            </article>
            <article className="downloads">
              <div className="avatar-row">
                {filteredProducts.slice(0, 3).map((p, i) => (
                  <img key={`avatar-${p.id}`} src={displayImage(p, 140 + i)} alt={p.name} />
                ))}
              </div>
              <h4>5m+</h4>
              <p>Downloads</p>
            </article>
            <article>
              <h4>Popular</h4>
              <p>Listening Has Been Released</p>
              <img src={displayImage(heroProducts[4] || filteredProducts[4] || {}, 105)} alt="release" />
            </article>
            <article>
              <h4>{heroProducts[5]?.name || "Light Grey Surface Headphone"}</h4>
              <p>Boosted with bass</p>
              <img src={displayImage(heroProducts[5] || filteredProducts[5] || {}, 106)} alt="trend" />
            </article>
          </div>
        </section>

        <section className="pet-strip">
          <h3>Browse Categories</h3>
          <p className="results-meta">{filteredProducts.length} results shown</p>
          <div className="pet-icons">
            {categoryChips.map((cat, idx) => (
              <button
                key={cat}
                type="button"
                className={`pet-chip ${activeCategory === cat ? "active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                <img src={buildUnsplash(`cat-${idx}`, `${cat} fashion apparel studio`, 120, 120)} alt="" />
                <span>{cat}</span>
              </button>
            ))}
            <button type="button" className={`pet-chip ${activeCategory === "All" ? "active" : ""}`} onClick={() => setActiveCategory("All")}>
              <img src={buildUnsplash("cat-all", "streetwear fashion collection", 120, 120)} alt="" />
              <span>Explore all</span>
            </button>
          </div>
        </section>

        <section className="section" id="shop">
          <div className="section-head">
            <h2>Shop Products</h2>
            {usingClosestMatches && (
              <p className="search-hint">
                No exact match for "{query}". Showing closest products.
              </p>
            )}
          </div>
          <div className="product-grid">
            {featuredProducts.map((item, idx) => (
              <article key={item.id} className="product-card" onClick={() => openProduct(item.id)}>
                <img src={displayImage(item, idx + 2)} alt={item.name} />
                <div className="product-body">
                  <h3>{item.name}</h3>
                  <div className="product-row">
                    <strong>{formatCurrency(item.price, storeRegion)}</strong>
                    <span>{item.rating.toFixed(1)}</span>
                  </div>
                  <div className="card-btns">
                    <button type="button" onClick={(event) => { event.stopPropagation(); addToCart(item.id); }}>Add to Cart</button>
                    <button type="button" className="buy" onClick={(event) => { event.stopPropagation(); openProduct(item.id); }}>Buy Now</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="trending">
          <div className="section-head">
            <h2>Trending Products</h2>
          </div>
          <div className="product-grid four">
            {trendingProducts.map((item, idx) => (
              <article key={item.id} className="product-card" onClick={() => openProduct(item.id)}>
                <img src={displayImage(item, idx + 8)} alt={item.name} />
                <div className="product-body">
                  <h3>{item.name}</h3>
                  <div className="product-row">
                    <strong>{formatCurrency(item.price, storeRegion)}</strong>
                    <span>{item.rating.toFixed(1)}</span>
                  </div>
                  <div className="card-btns">
                    <button type="button" onClick={(event) => { event.stopPropagation(); addToCart(item.id); }}>Add to Cart</button>
                    <button type="button" className="buy" onClick={(event) => { event.stopPropagation(); openProduct(item.id); }}>Buy Now</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="footer-shell">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo-wrap">
                <img
                  src={logoSrc}
                  alt="DBHS Alumni Association logo"
                  onError={() => {
                    if (logoSrc !== "./Assests/image.png") setLogoSrc("./Assests/image.png");
                  }}
                />
              </div>
              <h3>DBHS Alumni Association</h3>
              <p>Official alumni merchandise platform for chapters, reunions, and school legacy events.</p>
            </div>

            <div>
              <h4>Useful Links</h4>
              <a href="./Merch.html">About Us</a>
              <a href="./Checkout.html">Contact Us</a>
              <a href="./Auth.html">FAQs</a>
              <a href="./Auth.html">Terms of Service</a>
              <a href="./Auth.html">Privacy Policy</a>
            </div>
            <div>
              <h4>Resources</h4>
              <a href="./Merch.html#shop">Shop</a>
              <a href="./Merch.html#trending">Trending</a>
              <a href="./Merch.html#home">Top</a>
              <a href="./Checkout.html">Subscribe</a>
            </div>
            <div>
              <h4>Subscribe</h4>
              <p>Join our alumni community for product drops and reunion updates.</p>
              <div className="footer-subscribe">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                  placeholder="Enter your email"
                />
                <button type="button" onClick={subscribeNewsletter}>Subscribe</button>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <strong>DBHS Alumni.</strong>
            <div className="footer-policy">
              <a href="./Auth.html">Privacy Policy</a>
              <a href="./Auth.html">Terms of Service</a>
              <a href="./Auth.html">Cookie Policy</a>
            </div>
            <span>© 2026 DBHS Alumni Association. All rights reserved.</span>
          </div>
        </footer>
      </div>

      {notice && <p className="notice wrap">{notice}</p>}

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

          <div className="drawer-foot">
            <div className="line"><span>Subtotal</span><span>{formatCurrency(subtotal, storeRegion)}</span></div>
            <div className="line"><span>Shipping</span><span>{formatCurrency(shipping, storeRegion)}</span></div>
            <div className="line total"><span>Total</span><span>{formatCurrency(total, storeRegion)}</span></div>
            <button className="checkout-btn" type="button" disabled={!cartCount} onClick={goToCheckout}>
              Proceed to Checkout
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
