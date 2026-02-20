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
  const safeQuery = encodeURIComponent(query || "fashion product black minimal");
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80&query=${safeQuery}`;
}

function getProductImages(product) {
  const base = `${product.category || "apparel"} ${product.name || "merch"} black minimal product photo`;
  return [
    buildUnsplash(`${product.id}-1`, `${base} hero`, 1300, 920),
    buildUnsplash(`${product.id}-2`, `${base} closeup`, 680, 680),
    buildUnsplash(`${product.id}-3`, `${base} side`, 680, 680),
    buildUnsplash(`${product.id}-4`, `${base} studio`, 680, 680)
  ];
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
    reviewCount: Number(row.review_count || 24)
  };
}

function NotFound() {
  return (
    <main className="product-page">
      <section className="missing">
        <h2>Product not found</h2>
        <p>The product you selected does not exist.</p>
        <a href="./Merch.html">Back to shop</a>
      </section>
    </main>
  );
}

function ProductExperience({ product, region, onAdd, onBuy }) {
  const images = useMemo(() => getProductImages(product), [product]);
  const [activeShot, setActiveShot] = useState(0);
  const [size, setSize] = useState(product.sizes?.[0] || "One Size");
  const [qty, setQty] = useState(1);
  const primary = product.name || "legacy steel black sport pro strap";
  const words = primary.split(" ");
  const splitA = words.slice(0, 2).join(" ");
  const splitB = words.slice(2, 4).join(" ");
  const splitC = words.slice(4).join(" ") || "strap";

  return (
    <section className="focus-layout">
      <div className="focus-left">
        <a className="back-home" href="./Merch.html">back to home</a>
        <h1>
          <span>{splitA}</span>
          <span><mark>{splitB || "black sport pro"}</mark></span>
          <span><mark>{splitC}</mark></span>
        </h1>
        <p className="subtitle">{product.description}</p>

        <div className="review-stack">
          <div className="avatars">
            {images.slice(1, 4).map((src) => <img key={src} src={src} alt="" />)}
          </div>
          <span>product reviews</span>
          <strong>{product.rating.toFixed(1)}</strong>
        </div>

        <div className="buy-row">
          <strong>{formatCurrency(product.price, region)}</strong>
          <button type="button" onClick={() => onAdd(size, qty)}>add to cart</button>
          <button type="button" className="buy-now" onClick={() => onBuy(size, qty)}>buy now</button>
        </div>

        <div className="select-row">
          <label>
            size
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              {(product.sizes || ["One Size"]).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            qty
            <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <ul className="style-list">
          {(product.details || []).slice(0, 3).map((item, idx) => (
            <li key={item}><b>{String(idx + 1).padStart(2, "0")}.</b> {item}</li>
          ))}
        </ul>
      </div>

      <div className="focus-right">
        <div className="shot-wrap">
          <span className="tag">best seller</span>
          <img src={images[activeShot]} alt={product.name} />
          <div className="shot-footer">
            {images.map((src, idx) => (
              <button key={src} type="button" className={activeShot === idx ? "active" : ""} onClick={() => setActiveShot(idx)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = Number(params.get("id"));

  const [productsData, setProductsData] = useState(PRODUCT_SOURCE);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [storeRegion] = useState(localStorage.getItem("dbhs_store_region") || "jamaica");

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
      <header className="pro-top">
        <div className="left-filters">
          <select><option>straps</option></select>
          <select><option>accessories</option></select>
        </div>
        <a className="pro-logo" href="./Merch.html">pro straps</a>
        <div className="right-tools">
          <input type="search" placeholder="search..." />
          <a href="./Checkout.html">cart</a>
          <span>0</span>
          <button type="button" onClick={() => window.location.href = "./Merch.html"}>Menu</button>
        </div>
      </header>

      <ProductExperience product={product} region={storeRegion} onAdd={addToCart} onBuy={buyNow} />

      <section className="bottom-tabs">
        <button type="button">01 details</button>
        <button type="button">02 reviews</button>
        <button type="button">03 delivery</button>
      </section>

      {notice && <p className="notice">{notice}</p>}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProductPage />);
