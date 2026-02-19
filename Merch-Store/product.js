const { useState } = React;

function formatCurrency(value) {
  const amount = Number(value).toLocaleString("en-JM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `JMD $${amount}`;
}

function starText(value) {
  return "★".repeat(Math.round(value)) + "☆".repeat(5 - Math.round(value));
}

function NotFound() {
  return (
    <main className="page-shell">
      <section className="not-found">
        <h2>Product not found</h2>
        <p>The product you selected does not exist or the link is invalid.</p>
        <a className="chip-btn" href="./Merch.html">Back to Shop</a>
      </section>
    </main>
  );
}

function ProductGallery({ product }) {
  const shots = ["Front", "Angle", "Detail"];
  const [activeShot, setActiveShot] = useState(0);

  return (
    <section className="media-panel" aria-label="Product images">
      <div className="thumb-column">
        {shots.map((shot, index) => (
          <button
            type="button"
            key={shot}
            className={`thumb ${activeShot === index ? "active" : ""}`}
            onClick={() => setActiveShot(index)}
            aria-label={`View ${shot}`}
          >
            {product.code}
          </button>
        ))}
      </div>

      <div className="hero-shot">
        <div className={`shirt-canvas shot-${activeShot}`}>
          <img src="./Assests/image.png" alt="Association logo" className="shirt-logo" />
        </div>
      </div>
    </section>
  );
}

function ProductMeta({ product, onAdd, onBuy }) {
  const [size, setSize] = useState(product.sizes?.[0] || "One Size");
  const [color, setColor] = useState("#003f88ff");
  const [qty, setQty] = useState(1);

  const colors = ["#00296bff", "#003f88ff", "#00509dff", "#fdc500ff", "#ffd500ff"];

  return (
    <section className="meta-panel">
      <p className="crumb">Shop / Product</p>
      <h1>{product.name}</h1>
      <p className="sub">{product.subtitle}</p>

      <p className="stars">{starText(product.rating)} <span>{product.rating.toFixed(1)}</span> · {product.reviewCount} reviews</p>

      <div className="selector-group">
        <div className="selector-head">
          <span>Select Size</span>
          <button type="button">Size Guide</button>
        </div>
        <div className="size-row">
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

      <div className="selector-group">
        <div className="selector-head"><span>Colors Available</span></div>
        <div className="color-row">
          {colors.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`color-dot ${color === swatch ? "active" : ""}`}
              style={{ "--swatch": swatch }}
              onClick={() => setColor(swatch)}
              aria-label={`Color ${swatch}`}
            ></button>
          ))}
        </div>
      </div>

      <div className="buy-row">
        <button className="add-cart" type="button" onClick={() => onAdd(size, qty)}>Add to cart</button>
        <div className="price-pill">{formatCurrency(product.price)}</div>
      </div>

      <div className="quick-row">
        <label htmlFor="qty">Qty</label>
        <select id="qty" value={qty} onChange={(event) => setQty(Number(event.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button className="chip-btn" type="button" onClick={() => onBuy(size, qty)}>Buy now</button>
      </div>

      <div className="feature-grid">
        <div>🛡 Secure payment</div>
        <div>🚚 Free shipping</div>
        <div>📏 Size & fit support</div>
        <div>↩ Easy returns</div>
      </div>

      <div className="detail-copy">
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

  if (!product) return <NotFound />;

  const related = PRODUCTS.filter((item) => item.id !== product.id).slice(0, 3);

  function addToCart(size, qty) {
    setNotice(`Added ${qty} (${size}) to cart.`);
  }

  function buyNow(size, qty) {
    setNotice(`Checkout started for ${qty} (${size}).`);
  }

  return (
    <main className="page-shell">
      <header className="top-nav">
        <a className="top-brand" href="./Merch.html">DBHS</a>
        <nav>
          <a href="./Merch.html">Home</a>
          <a href="./Merch.html">Product</a>
          <a href="./Merch.html">Contact</a>
          <a href="./Merch.html">FAQ</a>
        </nav>
      </header>

      <section className="main-card">
        <ProductGallery product={product} />
        <ProductMeta product={product} onAdd={addToCart} onBuy={buyNow} />
      </section>

      {notice && <p className="notice">{notice}</p>}

      <section className="related-wrap">
        <h3>You may also like</h3>
        <div className="related-grid">
          {related.map((item) => (
            <a key={item.id} href={`./Product.html?id=${item.id}`} className="related-card">
              <div className="related-media">{item.code}</div>
              <p>{item.name}</p>
              <small>{formatCurrency(item.price)}</small>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProductPage />);
