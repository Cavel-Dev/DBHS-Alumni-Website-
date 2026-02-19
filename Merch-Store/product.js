const { useState } = React;

const STORE_REGIONS = {
  jamaica: { label: "Jamaica", symbol: "JMD $", locale: "en-JM", fx: 1 },
  us: { label: "United States", symbol: "US $", locale: "en-US", fx: 1 / 155 },
  uk: { label: "United Kingdom", symbol: "GBP ", locale: "en-GB", fx: 1 / 198 }
};

function formatCurrency(value, region = "jamaica") {
  const cfg = STORE_REGIONS[region] || STORE_REGIONS.jamaica;
  const amount = (Number(value || 0) * cfg.fx).toLocaleString(cfg.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${cfg.symbol}${amount}`;
}

function NotFound() {
  return (
    <main className="page-shell">
      <section className="not-found">
        <h2>Product not found</h2>
        <p>The product you selected does not exist or the link is invalid.</p>
        <a className="btn-outline" href="./Merch.html">Back to Shop</a>
      </section>
    </main>
  );
}

function ProductGallery({ product, logoSrc }) {
  const shots = ["Front", "Side", "Detail", "Back", "Close"];
  const [activeShot, setActiveShot] = useState(0);

  return (
    <section className="gallery-wrap" aria-label="Product images">
      <div className="thumb-column">
        {shots.map((shot, idx) => (
          <button
            key={shot}
            type="button"
            className={`thumb ${activeShot === idx ? "active" : ""}`}
            onClick={() => setActiveShot(idx)}
            aria-label={`View ${shot}`}
          >
            {product.code}
          </button>
        ))}
      </div>

      <div className="hero-shot">
        <div className={`product-form shot-${activeShot % 3}`}>
          <img src={logoSrc} alt="Association logo" className="product-logo" />
          <span className="product-code">{product.code}</span>
        </div>

        <div className="hero-nav">
          <button type="button" onClick={() => setActiveShot((s) => (s === 0 ? shots.length - 1 : s - 1))}>{"<"}</button>
          <button type="button" onClick={() => setActiveShot((s) => (s + 1) % shots.length)}>{">"}</button>
        </div>
      </div>
    </section>
  );
}

function ProductMeta({ product, onAdd, onBuy, region }) {
  const [size, setSize] = useState(product.sizes?.[0] || "One Size");
  const [color, setColor] = useState("#f0efe8");
  const [qty, setQty] = useState(1);
  const [favorited, setFavorited] = useState(false);

  const colors = ["#f0efe8", "#d9d9d9", "#111111", "#003f88", "#fdc500"];
  const originalPrice = Math.round(product.price * 1.24);
  const viewers = 11 + (product.id % 18);
  const stock = 3 + (product.id % 5);

  return (
    <section className="meta-wrap">
      <h1>{product.name}</h1>
      <p className="sub">{product.subtitle}</p>

      <p className="review-row">Rating <span>{product.rating.toFixed(1)}</span> | {product.reviewCount} customer review</p>

      <div className="price-row">
        <strong>{formatCurrency(product.price, region)}</strong>
        <del>{formatCurrency(originalPrice, region)}</del>
        <span className="save-pill">Save 24%</span>
      </div>

      <p className="live-row">{viewers} viewing right now | only {stock} item(s) left in stock</p>

      <div className="selector-group">
        <h3>Color</h3>
        <div className="color-row">
          {colors.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`color-dot ${color === swatch ? "active" : ""}`}
              style={{ "--swatch": swatch }}
              onClick={() => setColor(swatch)}
            />
          ))}
        </div>
      </div>

      <div className="selector-group">
        <div className="size-head">
          <h3>Select Size</h3>
          <button type="button" className="size-guide">Size guide</button>
        </div>
        <div className="size-grid">
          {(product.sizes || ["One Size"]).map((item) => (
            <button
              key={item}
              type="button"
              className={`size-pill ${size === item ? "active" : ""}`}
              onClick={() => setSize(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="qty-row">
        <label htmlFor="qty">Qty</label>
        <select id="qty" value={qty} onChange={(event) => setQty(Number(event.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <button className="btn-primary" type="button" onClick={() => onAdd(size, qty)}>Add to Cart</button>
      <button className="btn-outline" type="button" onClick={() => setFavorited((v) => !v)}>
        {favorited ? "Favorited" : "Favorite"}
      </button>
      <button className="btn-buy" type="button" onClick={() => onBuy(size, qty)}>Buy Now</button>

      <div className="about-block">
        <h3>About the product</h3>
        <p>{product.description}</p>
        <ul>
          {product.details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProductPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = Number(params.get("id"));
  const product = PRODUCTS.find((item) => item.id === productId);
  const [notice, setNotice] = useState("");
  const [logoSrc, setLogoSrc] = useState("./Assests/image-removebg-preview%20(4).png");
  const [storeRegion] = useState(localStorage.getItem("dbhs_store_region") || "jamaica");

  if (!product) return <NotFound />;

  const related = PRODUCTS.filter((item) => item.id !== product.id).slice(0, 4);

  function addToCart(size, qty) {
    setNotice(`Added ${qty} (${size}) to cart.`);
  }

  function buyNow(size, qty) {
    setNotice(`Checkout started for ${qty} (${size}).`);
  }

  return (
    <main className="page-shell">
      <header className="top-bar">
        <a className="top-brand" href="./Merch.html">
          <img
            src={logoSrc}
            alt="DBHS logo"
            onError={() => {
              if (logoSrc !== "./Assests/image.png") setLogoSrc("./Assests/image.png");
            }}
          />
          <span>DBHS Alumni Merch</span>
        </a>

        <nav>
          <a href="./Merch.html">Home</a>
          <a href="./Merch.html#shop">Shop</a>
          <a href="./Merch.html#wishlist">Wishlist</a>
          <a href="./Merch.html#support">Support</a>
        </nav>

        <div className="top-search">{STORE_REGIONS[storeRegion].label}</div>
      </header>

      <section className="product-layout">
        <ProductGallery product={product} logoSrc={logoSrc} />
        <ProductMeta product={product} onAdd={addToCart} onBuy={buyNow} region={storeRegion} />
      </section>

      {notice && <p className="notice">{notice}</p>}

      <section className="related-wrap">
        <h2>You may also like</h2>
        <div className="related-grid">
          {related.map((item) => (
            <a key={item.id} href={`./Product.html?id=${item.id}`} className="related-card">
              <div className="related-media">{item.code}</div>
              <h3>{item.name}</h3>
              <p>{formatCurrency(item.price, storeRegion)}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProductPage />);
