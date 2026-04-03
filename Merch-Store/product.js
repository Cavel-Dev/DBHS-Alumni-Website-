const { useEffect, useMemo, useState } = React;

const STORE_REGIONS = {
  jamaica: { label: "Jamaica", symbol: "JMD $", locale: "en-JM", fx: 1 },
  us: { label: "United States", symbol: "US $", locale: "en-US", fx: 1 / 155 },
  uk: { label: "United Kingdom", symbol: "GBP ", locale: "en-GB", fx: 1 / 198 }
};

const PRODUCT_SOURCE =
  (typeof PRODUCTS !== "undefined" && Array.isArray(PRODUCTS) && PRODUCTS) ||
  (Array.isArray(window.PRODUCTS) && window.PRODUCTS) ||
  [];

function formatCurrency(value, region = "jamaica") {
  const cfg = STORE_REGIONS[region] || STORE_REGIONS.jamaica;
  const amount = (Number(value || 0) * cfg.fx).toLocaleString(cfg.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${cfg.symbol}${amount}`;
}

function buildUnsplash(seed, query, width = 1200, height = 900) {
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
  const safeQuery = encodeURIComponent(query || "alumni apparel product");
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80&query=${safeQuery}`;
}

function getProductImages(product) {
  const base = `${product.category || "apparel"} ${product.name || "merch"} alumni product studio`;
  const generated = [
    buildUnsplash(`${product.id}-1`, `${base} hero`, 1200, 900),
    buildUnsplash(`${product.id}-2`, `${base} closeup`, 680, 680),
    buildUnsplash(`${product.id}-3`, `${base} detail`, 680, 680),
    buildUnsplash(`${product.id}-4`, `${base} lifestyle`, 680, 680)
  ];
  if (product.image_url) return [product.image_url, ...generated.slice(1)];
  return generated;
}

function mapSupabaseProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category || "General",
    price: Number(row.price_jmd || 0),
    subtitle: row.subtitle || "Official alumni merchandise",
    code: row.code || "DBHS",
    description: row.description || "Official DBHS alumni product.",
    details: Array.isArray(row.details) && row.details.length ? row.details : ["Official alumni product", "Member-only store item"],
    sizes: Array.isArray(row.sizes) && row.sizes.length ? row.sizes : ["One Size"],
    rating: Number(row.rating || 4.7),
    reviewCount: Number(row.review_count || 24),
    image_url: row.image_url || null
  };
}

function NotFound() {
  return (
    <main className="product-page">
      <section className="missing">
        <h2>Product not found</h2>
        <p>The product you selected does not exist or link is invalid.</p>
        <a href="./Merch.html">Back to shop</a>
      </section>
    </main>
  );
}

function ProductDetails({ product, region, onAdd, onBuy }) {
  const images = useMemo(() => getProductImages(product), [product]);
  const [activeShot, setActiveShot] = useState(0);
  const [size, setSize] = useState(product.sizes?.[0] || "One Size");
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("details");

  return (
    <>
      <section className="product-main">
        <section className="gallery">
          <div className="hero-shot">
            <img src={images[activeShot]} alt={product.name} />
            <span className="badge">{product.code || "DBHS"}</span>
          </div>
          <div className="thumb-row">
            {images.map((src, idx) => (
              <button key={src} type="button" className={activeShot === idx ? "active" : ""} onClick={() => setActiveShot(idx)}>
                <img src={src} alt="" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        <section className="meta">
          <p className="crumb">{product.category} / Product Detail</p>
          <h1>{product.name}</h1>
          <p className="subtitle">{product.subtitle}</p>

          <p className="rating">{product.rating.toFixed(1)} rating • {product.reviewCount} reviews</p>
          <div className="price">{formatCurrency(product.price, region)}</div>

          <div className="selectors">
            <label>
              Size
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                {(product.sizes || ["One Size"]).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="actions">
            <button type="button" className="btn-add" onClick={() => onAdd(size, qty)}>Add to Cart</button>
            <button type="button" className="btn-buy" onClick={() => onBuy(size, qty)}>Buy Now</button>
          </div>
        </section>
      </section>

      <section className="tabs">
        <div className="tab-head">
          <button type="button" className={tab === "details" ? "active" : ""} onClick={() => setTab("details")}>Details</button>
          <button type="button" className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>Reviews</button>
          <button type="button" className={tab === "delivery" ? "active" : ""} onClick={() => setTab("delivery")}>Delivery</button>
        </div>

        {tab === "details" && (
          <div className="tab-body">
            <p>{product.description}</p>
            <ul>
              {(product.details || []).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        {tab === "reviews" && (
          <div className="tab-body">
            <p>Members rate this item highly for quality and fit.</p>
            <p>Average rating: {product.rating.toFixed(1)} from {product.reviewCount} reviews.</p>
          </div>
        )}

        {tab === "delivery" && (
          <div className="tab-body">
            <p>Standard delivery: 3-7 business days.</p>
            <p>Express delivery options available at checkout.</p>
          </div>
        )}
      </section>
    </>
  );
}

function ProductPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = Number(params.get("id"));

  const [productsData, setProductsData] = useState(PRODUCT_SOURCE);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [logoSrc, setLogoSrc] = useState("./Assests/image-removebg-preview%20(4).png");
  const [storeRegion, setStoreRegion] = useState(localStorage.getItem("dbhs_store_region") || "jamaica");

  useEffect(() => {
    let cancelled = false;

    async function loadProductsFromSupabase() {
      if (!window.dbhsSupabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await window.dbhsSupabase
        .from("merch_products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (!cancelled && !error && data && data.length > 0) {
        setProductsData(data.map(mapSupabaseProduct));
      }

      if (!cancelled) setLoading(false);
    }

    loadProductsFromSupabase();
    return () => {
      cancelled = true;
    };
  }, []);

  const product = productsData.find((item) => Number(item.id) === productId);
  const related = productsData.filter((item) => Number(item.id) !== productId).slice(0, 4);

  if (loading && !product) return <main className="product-page"><section className="missing"><h2>Loading product...</h2></section></main>;
  if (!product) return <NotFound />;

  function addToCart(size, qty) {
    const existing = JSON.parse(localStorage.getItem("dbhs_merch_cart") || "{}");
    const next = { ...existing, [product.id]: (Number(existing[product.id]) || 0) + qty };
    localStorage.setItem("dbhs_merch_cart", JSON.stringify(next));
    setNotice(`Added ${qty} (${size}) to cart.`);
  }

  function buyNow(size, qty) {
    const existing = JSON.parse(localStorage.getItem("dbhs_merch_cart") || "{}");
    const next = { ...existing, [product.id]: (Number(existing[product.id]) || 0) + qty };
    localStorage.setItem("dbhs_merch_cart", JSON.stringify(next));
    window.location.href = "./Checkout.html";
  }

  return (
    <main className="product-page">
      <header className="top-bar">
        <a className="brand" href="./Merch.html">
          <img
            src={logoSrc}
            alt="DBHS Alumni Association logo"
            onError={() => {
              if (logoSrc !== "./Assests/image.png") setLogoSrc("./Assests/image.png");
            }}
          />
          <span>DBHS Alumni Association</span>
        </a>

        <div className="top-actions">
          <select value={storeRegion} onChange={(e) => setStoreRegion(e.target.value)}>
            <option value="jamaica">Jamaica</option>
            <option value="us">US</option>
            <option value="uk">UK</option>
          </select>
          <a href="./Checkout.html">Checkout</a>
          <a href="./Merch.html">Back to Shop</a>
        </div>
      </header>

      <ProductDetails product={product} region={storeRegion} onAdd={addToCart} onBuy={buyNow} />

      <section className="related">
        <h3>Related products</h3>
        <div className="related-grid">
          {related.map((item, idx) => (
            <a key={item.id} href={`./Product.html?id=${item.id}`} className="related-card">
              <img src={getProductImages(item)[0] || buildUnsplash(`rel-${idx}`, item.name, 520, 360)} alt={item.name} />
              <div>
                <strong>{item.name}</strong>
                <span>{formatCurrency(item.price, storeRegion)}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {notice && <p className="notice">{notice}</p>}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProductPage />);
