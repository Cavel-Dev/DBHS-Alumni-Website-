const { useMemo, useState } = React;

const CATEGORIES = ["All Categories", ...new Set(PRODUCTS.map((item) => item.category))];

function formatCurrency(value) {
  const amount = Number(value).toLocaleString("en-JM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `JMD $${amount}`;
}

function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [sortBy, setSortBy] = useState("new");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [logoSrc, setLogoSrc] = useState("./Assests/image-removebg-preview%20(4).png");
  const [wishlist, setWishlist] = useState([]);

  const filteredProducts = useMemo(() => {
    let list = PRODUCTS.filter((item) => {
      const categoryMatch = category === "All Categories" || item.category === category;
      const queryMatch = item.name.toLowerCase().includes(query.toLowerCase().trim());
      return categoryMatch && queryMatch;
    });

    if (sortBy === "price-low") list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") list = [...list].sort((a, b) => b.price - a.price);
    if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "top-rated") list = [...list].sort((a, b) => b.rating - a.rating);

    return list;
  }, [query, category, sortBy]);

  const cartEntries = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = PRODUCTS.find((item) => item.id === Number(id));
          return product ? { product, qty } : null;
        })
        .filter(Boolean),
    [cart]
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

  function checkout() {
    if (!cartCount) return;
    setCart({});
    setNotice("Order sent to DBHS Alumni Association store team.");
    setCartOpen(false);
  }

  function openProduct(id) {
    window.location.href = `./Product.html?id=${id}`;
  }

  function toggleWishlist(id) {
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const topPicks = PRODUCTS.slice(0, 3);

  return (
    <>
      <header className="site-header">
        <div className="wrap header-row">
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
            <span className="brand-text">
              <strong>Discovery Bay High School</strong>
              <small>Alumni Association</small>
            </span>
          </a>

          <nav className="top-nav" aria-label="Main navigation">
            <a href="#shop">Shop</a>
            <a href="#profile">Profile</a>
            <a href="#top-picks">Top Picks</a>
            <a href="#support">Support</a>
          </nav>

          <div className="header-actions">
            <button
              className="header-btn header-btn-ghost"
              type="button"
              onClick={() => {
                const node = document.getElementById("wishlist");
                if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Wishlist {wishlist.length ? `(${wishlist.length})` : ""}
            </button>
            <button className="header-btn" type="button" onClick={() => setCartOpen(true)} aria-label="Open cart">
              Cart {cartCount ? `(${cartCount})` : ""}
            </button>
          </div>
        </div>
      </header>

      <main className="wrap main-area" id="shop">
        <section className="promo-banner">
          <p>Alumni Weekend Flash Sale: 15% off select merch</p>
          <span>Ends in 02d : 11h : 38m</span>
        </section>

        <section className="hero-grid">
          <article className="intro card">
            <h1>Wear the Legacy. Support the Future.</h1>
            <p>
              Every DBHS Alumni merch purchase helps fund mentorship, scholarships,
              and student development programs.
            </p>
            <div className="hero-cta-row">
              <button className="cta-primary" type="button" onClick={() => setCartOpen(true)}>Checkout Now</button>
              <button className="cta-ghost" type="button" onClick={() => window.scrollTo({ top: 560, behavior: "smooth" })}>Browse Collection</button>
            </div>
            <div className="trust-row" id="support">
              <span>Secure checkout</span>
              <span>Fast islandwide delivery</span>
              <span>100% alumni-backed</span>
            </div>
          </article>

          <article className="profile-card card" id="profile">
            <h2>Alumni Profile</h2>
            <div className="profile-head">
              <div className="avatar">AA</div>
              <div>
                <strong>Alumni Ambassador</strong>
                <p>Class of 2024 · Chapter in Jamaica</p>
              </div>
            </div>
            <div className="profile-stats">
              <div><strong>48</strong><span>Members</span></div>
              <div><strong>JMD $0</strong><span>Raised</span></div>
              <div><strong>1%</strong><span>Goal</span></div>
            </div>
            <div className="progress-wrap" aria-label="Fundraising progress">
              <div className="progress-bar"></div>
            </div>
            <p className="profile-note">Buy merch to push this month’s support drive over the finish line.</p>
          </article>
        </section>

        <section className="filters" aria-label="Product filters">
          <label className="filter-pill search-pill">
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find merch"
            />
          </label>

          <label className="filter-pill">
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="filter-pill">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="new">New In</option>
              <option value="top-rated">Top Rated</option>
              <option value="price-low">Price Low to High</option>
              <option value="price-high">Price High to Low</option>
              <option value="name">Name</option>
            </select>
          </label>
        </section>

        <section className="results-meta">
          <span>{filteredProducts.length} items</span>
          <span>All prices in JMD</span>
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
                    {wished ? "♥ Wishlisted" : "♡ Wishlist"}
                  </button>
                  <div className="product-badge">{item.code}</div>
                  <span className="stock-tag">Only {lowStock} left</span>
                </div>

                <div className="product-info">
                  <h3>{item.name}</h3>
                  <p>{item.subtitle}</p>
                  <div className="rating-row">★ {item.rating.toFixed(1)} ({item.reviewCount})</div>
                  <div className="card-foot">
                    <strong>{formatCurrency(item.price)}</strong>
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

        <section className="top-picks" id="top-picks">
          <h2>Top Picks This Week</h2>
          <div className="top-pick-grid">
            {topPicks.map((item) => (
              <a key={item.id} href={`./Product.html?id=${item.id}`} className="pick-card">
                <div className="pick-media">{item.code}</div>
                <div>
                  <h3>{item.name}</h3>
                  <p>{formatCurrency(item.price)}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {wishlist.length > 0 && (
          <section className="top-picks" id="wishlist">
            <h2>Your Wishlist</h2>
            <div className="top-pick-grid">
              {PRODUCTS.filter((item) => wishlist.includes(item.id)).map((item) => (
                <a key={item.id} href={`./Product.html?id=${item.id}`} className="pick-card">
                  <div className="pick-media">{item.code}</div>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{formatCurrency(item.price)}</p>
                  </div>
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
                  <p>{formatCurrency(product.price * qty)}</p>
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
            <div className="line"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="line"><span>Shipping</span><span>{formatCurrency(shipping)}</span></div>
            <div className="line total"><span>Total</span><span>{formatCurrency(total)}</span></div>
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

