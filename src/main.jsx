import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleAlert,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  LockKeyhole,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  UserPlus,
  X,
  Factory,
  Clock,
} from "lucide-react";
import "./style.css";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Inventory", icon: Package, active: true },
  { label: "Production", icon: ClipboardList },
  { label: "Order", icon: Boxes },
  { label: "Report", icon: LayoutDashboard },
  { label: "User Access", icon: Users },
  { label: "Support", icon: CircleHelp },
  { label: "Setting", icon: Settings },
];

const demoLogin = {
  email: "dara.vann@demo.example",
  password: "Demo-3d288e62840fbced1fc7c942ea6ab6df-Aa1!",
};

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function stockStatus(product) {
  if (product.stock <= 0) return { label: "Out of stock", className: "out" };
  if (product.stock <= product.lowStockThreshold) {
    return { label: "Low stock", className: "low" };
  }
  return { label: "In stock", className: "good" };
}

function ProductionPage({ products, orders, loading, error, onCreate, onComplete, onCancel }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    outputProductId: "",
    quantity: "1",
    materials: [{ productId: "", quantityPerUnit: "1" }],
  });
  const finishedGoods = products.filter((product) => product.category === "Finished Good");
  const rawMaterials = products.filter((product) => product.category === "Raw Material");
  const plannedCount = orders.filter((order) => order.status === "PLANNED").length;
  const completedCount = orders.filter((order) => order.status === "COMPLETED").length;

  function openOrderModal() {
    setFormError("");
    setForm({
      outputProductId: finishedGoods[0] ? String(finishedGoods[0].id) : "",
      quantity: "1",
      materials: [{ productId: rawMaterials[0] ? String(rawMaterials[0].id) : "", quantityPerUnit: "1" }],
    });
    setModalOpen(true);
  }

  function updateMaterial(index, field, value) {
    setForm((current) => ({
      ...current,
      materials: current.materials.map((material, materialIndex) =>
        materialIndex === index ? { ...material, [field]: value } : material,
      ),
    }));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await onCreate({
        outputProductId: Number(form.outputProductId),
        quantity: Number(form.quantity),
        materials: form.materials.map((material) => ({
          productId: Number(material.productId),
          quantityPerUnit: Number(material.quantityPerUnit),
        })),
      });
      setModalOpen(false);
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content">
      <div className="page-heading production-heading">
        <div className="title-line">
          <h1>Production</h1>
          <span className="inventory-count">Work orders</span>
        </div>
        <p>Plan manufacturing orders, check raw-material availability, and update finished stock.</p>
      </div>

      <div className="production-summary">
        <article className="production-stat">
          <span className="production-stat-icon"><ClipboardList size={19} /></span>
          <div><small>Total work orders</small><b>{orders.length}</b></div>
        </article>
        <article className="production-stat">
          <span className="production-stat-icon planned-icon"><Factory size={19} /></span>
          <div><small>Planned</small><b>{plannedCount}</b></div>
        </article>
        <article className="production-stat">
          <span className="production-stat-icon completed-icon"><Check size={19} /></span>
          <div><small>Completed</small><b>{completedCount}</b></div>
        </article>
      </div>

      <div className="production-card">
        <div className="production-card-header">
          <div><h2>Production orders</h2><p>Each order includes a bill of materials and stock movement.</p></div>
          <button className="primary-button" type="button" onClick={openOrderModal} disabled={!finishedGoods.length || !rawMaterials.length}>
            <Plus size={17} /> New production order
          </button>
        </div>
        {(!finishedGoods.length || !rawMaterials.length) && (
          <div className="production-hint">
            Add at least one Finished Good and one Raw Material in Inventory before creating a production order.
          </div>
        )}
        {loading && <div className="empty-state"><span className="spinner" /><b>Loading production orders…</b></div>}
        {!loading && error && <div className="empty-state error-state"><AlertTriangle size={25} /><b>Could not load production orders</b><p>{error}</p></div>}
        {!loading && !error && orders.length === 0 && (
          <div className="empty-state">
            <Factory size={27} />
            <b>No production orders yet</b>
            <p>Create an order with a product and the raw materials needed to make it.</p>
          </div>
        )}
        {!loading && !error && orders.length > 0 && (
          <div className="production-table-wrap">
            <table className="production-table">
              <thead><tr><th>ORDER</th><th>FINISHED PRODUCT</th><th>QUANTITY</th><th>BILL OF MATERIALS</th><th>STATUS</th><th>ACTION</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><code>MO-{String(order.id).padStart(5, "0")}</code><small className="order-date">{new Date(order.createdAt).toLocaleDateString()}</small></td>
                    <td><b>{order.outputProduct.name}</b><small className="order-date">{order.outputProduct.sku}</small></td>
                    <td><b>{order.quantity}</b> units</td>
                    <td><div className="bom-list">{order.materials.map((material) => (
                      <span key={material.id}>{material.product.name}<small>{material.quantityPerUnit * order.quantity} required</small></span>
                    ))}</div></td>
                    <td><span className={`order-status ${order.status.toLowerCase()}`}>{order.status === "COMPLETED" ? "Completed" : order.status === "CANCELLED" ? "Cancelled" : "Planned"}</span></td>
                    <td>
                      {order.status === "PLANNED" ? (
                        <div className="production-actions">
                          <button className="complete-order" type="button" onClick={() => onComplete(order.id)}>
                            <Check size={14} /> Complete
                          </button>
                          <button className="cancel-order" type="button" onClick={() => onCancel(order.id)}>Cancel</button>
                        </div>
                      ) : <span className="completed-date">{order.completedAt ? new Date(order.completedAt).toLocaleDateString() : "—"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="inventory-footnote"><AlertTriangle size={14} /> Completing an order consumes its listed materials and adds the produced quantity to finished stock.</p>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className="modal production-modal" role="dialog" aria-modal="true" aria-labelledby="production-modal-title">
            <div className="modal-header">
              <div><h2 id="production-modal-title">New production order</h2><p>Choose an output and define the raw materials per unit.</p></div>
              <button className="icon-button" type="button" aria-label="Close dialog" onClick={() => setModalOpen(false)}><X size={19} /></button>
            </div>
            <form className="modal-form" onSubmit={submitOrder}>
              <label>Finished product
                <select required value={form.outputProductId} onChange={(event) => setForm((current) => ({ ...current, outputProductId: event.target.value }))}>
                  <option value="">Select finished product</option>
                  {finishedGoods.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}
                </select>
              </label>
              <label>Production quantity
                <input required type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
              </label>
              <div className="bom-form-header"><b>Bill of materials</b><span>Required quantity for one finished unit</span></div>
              {form.materials.map((material, index) => {
                const selected = rawMaterials.find((product) => product.id === Number(material.productId));
                return (
                  <div className="bom-form-row" key={index}>
                    <label>Raw material
                      <select required value={material.productId} onChange={(event) => updateMaterial(index, "productId", event.target.value)}>
                        <option value="">Select a raw material</option>
                        {rawMaterials.filter((product) => !form.materials.some((selectedMaterial, materialIndex) => materialIndex !== index && selectedMaterial.productId === String(product.id))).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stock} in stock</option>)}
                      </select>
                    </label>
                    <label>Per unit
                      <input required type="number" min="1" step="1" value={material.quantityPerUnit} onChange={(event) => updateMaterial(index, "quantityPerUnit", event.target.value)} />
                    </label>
                    {form.materials.length > 1 && <button className="remove-material" type="button" aria-label="Remove material" onClick={() => setForm((current) => ({ ...current, materials: current.materials.filter((_, materialIndex) => materialIndex !== index) }))}><X size={16} /></button>}
                    {selected && <small className="material-availability">{selected.stock} available · {Number(material.quantityPerUnit || 0) * Number(form.quantity || 0)} required</small>}
                  </div>
                );
              })}
              {form.materials.length < 50 && <button className="add-material" type="button" onClick={() => setForm((current) => ({ ...current, materials: [...current.materials, { productId: "", quantityPerUnit: "1" }] }))}><Plus size={15} /> Add raw material</button>}
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="primary-button" type="submit" disabled={saving}>{saving ? "Creating…" : "Create order"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function OrdersPage({ products, orders, loading, error, onCreate, onProcess, onFulfill, onCancel }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState({
    customer: "",
    email: "",
    notes: "",
    items: [{ productId: "", quantity: "1" }],
  });
  const saleProducts = products.filter((product) => product.category === "Finished Good");
  const filteredOrders = orders.filter((order) => {
    const search = `${order.customer} ${order.email || ""} SO-${String(order.id).padStart(5, "0")}`.toLowerCase();
    return search.includes(query.toLowerCase()) && (statusFilter === "ALL" || order.status === statusFilter);
  });
  const openCount = orders.filter((order) => order.status === "OPEN").length;
  const processingCount = orders.filter((order) => order.status === "PROCESSING").length;
  const fulfilledRevenue = orders
    .filter((order) => order.status === "FULFILLED")
    .reduce((total, order) => total + order.totalAmount, 0);

  function openCreateModal() {
    setFormError("");
    setForm({
      customer: "",
      email: "",
      notes: "",
      items: [{ productId: saleProducts[0] ? String(saleProducts[0].id) : "", quantity: "1" }],
    });
    setModalOpen(true);
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await onCreate({
        customer: form.customer,
        email: form.email,
        notes: form.notes,
        items: form.items.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
        })),
      });
      setModalOpen(false);
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  const draftTotal = form.items.reduce((total, item) => {
    const product = saleProducts.find((candidate) => candidate.id === Number(item.productId));
    return total + (product?.unitPrice || 0) * (Number(item.quantity) || 0);
  }, 0);

  return (
    <section className="content">
      <div className="page-heading order-heading">
        <div className="title-line"><h1>Orders</h1><span className="inventory-count">Sales management</span></div>
        <p>Create customer orders, track fulfillment, and review sales totals.</p>
      </div>
      <div className="production-summary order-summary">
        <article className="production-stat"><span className="production-stat-icon"><ShoppingCart size={19} /></span><div><small>Total orders</small><b>{orders.length}</b></div></article>
        <article className="production-stat"><span className="production-stat-icon planned-icon"><ClipboardList size={19} /></span><div><small>Open / processing</small><b>{openCount + processingCount}</b></div></article>
        <article className="production-stat"><span className="production-stat-icon completed-icon"><Check size={19} /></span><div><small>Fulfilled revenue</small><b>${fulfilledRevenue.toFixed(2)}</b></div></article>
      </div>
      <div className="production-card">
        <div className="production-card-header">
          <div><h2>Customer orders</h2><p>Stock is deducted when an order is fulfilled.</p></div>
          <button className="primary-button" type="button" onClick={openCreateModal} disabled={!saleProducts.length}><Plus size={17} /> Create order</button>
        </div>
        {!saleProducts.length && <div className="production-hint">Add at least one Finished Good in Inventory before creating a sales order.</div>}
        <div className="order-toolbar">
          <label className="search-field"><Search size={17} /><input aria-label="Search orders" placeholder="Search customer or order number" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="select-control"><select aria-label="Filter orders by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="PROCESSING">Processing</option><option value="FULFILLED">Fulfilled</option><option value="CANCELLED">Cancelled</option></select><ChevronDown size={16} /></label>
        </div>
        {loading && <div className="empty-state"><span className="spinner" /><b>Loading customer orders…</b></div>}
        {!loading && error && <div className="empty-state error-state"><AlertTriangle size={25} /><b>Could not load orders</b><p>{error}</p></div>}
        {!loading && !error && filteredOrders.length === 0 && (
          <div className="empty-state"><ShoppingCart size={27} /><b>{orders.length ? "No matching orders" : "No customer orders yet"}</b><p>{orders.length ? "Try another search or status filter." : "Create an order to start tracking customer sales."}</p></div>
        )}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="production-table-wrap">
            <table className="production-table sales-order-table">
              <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th>ACTION</th></tr></thead>
              <tbody>{filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td><code>SO-{String(order.id).padStart(5, "0")}</code><small className="order-date">{new Date(order.createdAt).toLocaleDateString()}</small></td>
                  <td><b>{order.customer}</b>{order.email && <small className="order-date">{order.email}</small>}</td>
                  <td><div className="sales-order-items">{order.items.map((item) => <span key={item.id}>{item.productName} × {item.quantity}<small>{item.sku}</small></span>)}</div></td>
                  <td><b>${order.totalAmount.toFixed(2)}</b></td>
                  <td><span className={`order-status ${order.status.toLowerCase()}`}>{order.status === "OPEN" ? "Open" : order.status === "PROCESSING" ? "Processing" : order.status === "FULFILLED" ? "Fulfilled" : "Cancelled"}</span></td>
                  <td><div className="production-actions">
                    {order.status === "OPEN" && <button className="complete-order" type="button" onClick={() => onProcess(order.id)}>Process</button>}
                    {(order.status === "OPEN" || order.status === "PROCESSING") && <button className="fulfill-order" type="button" onClick={() => onFulfill(order.id)}>Fulfill</button>}
                    {(order.status === "OPEN" || order.status === "PROCESSING") && <button className="cancel-order" type="button" onClick={() => onCancel(order.id)}>Cancel</button>}
                    {order.status === "FULFILLED" && <span className="completed-date">{order.fulfilledAt ? new Date(order.fulfilledAt).toLocaleDateString() : "—"}</span>}
                    {order.status === "CANCELLED" && <span className="completed-date">—</span>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      <p className="inventory-footnote"><AlertTriangle size={14} /> Orders do not reserve stock until fulfillment. Inventory is checked again when fulfilled.</p>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className="modal production-modal sales-order-modal" role="dialog" aria-modal="true" aria-labelledby="sales-order-modal-title">
            <div className="modal-header"><div><h2 id="sales-order-modal-title">Create customer order</h2><p>Add customer details and the products they ordered.</p></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={() => setModalOpen(false)}><X size={19} /></button></div>
            <form className="modal-form" onSubmit={submitOrder}>
              <label>Customer name<input required maxLength="120" value={form.customer} onChange={(event) => setForm((current) => ({ ...current, customer: event.target.value }))} /></label>
              <label>Email (optional)<input type="email" maxLength="254" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <div className="bom-form-header"><b>Order items</b><span>Current product prices are saved to the order</span></div>
              {form.items.map((item, index) => {
                const product = saleProducts.find((candidate) => candidate.id === Number(item.productId));
                return <div className="sales-item-row" key={index}>
                  <label>Finished product<select required value={item.productId} onChange={(event) => updateItem(index, "productId", event.target.value)}><option value="">Select a product</option>{saleProducts.filter((candidate) => !form.items.some((selected, itemIndex) => itemIndex !== index && selected.productId === String(candidate.id))).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · ${candidate.unitPrice.toFixed(2)}</option>)}</select></label>
                  <label>Qty<input required type="number" min="1" max={product?.stock || undefined} step="1" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} /></label>
                  {form.items.length > 1 && <button className="remove-material" type="button" aria-label="Remove item" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><X size={16} /></button>}
                  {product && <small className="material-availability">{product.stock} available · ${(product.unitPrice * Number(item.quantity || 0)).toFixed(2)} line total</small>}
                </div>;
              })}
              {form.items.length < 50 && <button className="add-material" type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { productId: "", quantity: "1" }] }))}><Plus size={15} /> Add another product</button>}
              <label>Order notes (optional)<input maxLength="500" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
              <div className="sale-stock sale-total"><span>Order total</span><b>${draftTotal.toFixed(2)}</b></div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Creating…" : "Create order"}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AuthPage({ mode, setupAvailable, startupError, onSubmit, onRetry }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSetup = mode === "setup";
  const isChecking = mode === "checking";

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    if (isSetup && password !== passwordConfirm) {
      setFormError("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(isSetup ? "setup" : "login", {
        ...(isSetup ? { fullName, setupSecret } : {}),
        email,
        password,
      });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Boxes size={21} /></span><span className="brand-name">Inventra</span></div>
        <span className="auth-icon"><LockKeyhole size={21} /></span>
        <h1>{isChecking ? "Checking your session" : isSetup ? "Set up your workspace" : "Welcome back"}</h1>
        <p className="auth-intro">{isChecking ? "Please wait while we verify your session." : isSetup ? "Create the first administrator account to secure your ERP." : "Sign in to continue to your workspace."}</p>
        {isChecking ? <div className="empty-state auth-loading"><span className="spinner" /></div> : startupError ? (
          <div className="report-error auth-error" role="alert"><AlertTriangle size={17} /><span>{startupError}</span><button type="button" onClick={onRetry}>Retry</button></div>
        ) : (
          <>
          {!isSetup && <aside className="demo-login" aria-label="Demo account credentials">
            <div className="demo-login-heading"><b>Try the demo account</b><span>Staff access</span></div>
            <dl>
              <div><dt>Email</dt><dd><code>{demoLogin.email}</code></dd></div>
              <div><dt>Password</dt><dd><code>{demoLogin.password}</code></dd></div>
            </dl>
            <button className="secondary-button demo-login-button" type="button" onClick={() => { setEmail(demoLogin.email); setPassword(demoLogin.password); }}>Fill demo login</button>
            <p>Shared public demo account. Changes may be visible to other visitors.</p>
          </aside>}
          <form className="auth-form" onSubmit={submit}>
            {isSetup && !setupAvailable && <div className="auth-setup-help" role="note"><b>Setup secret required</b><span>Set <code>AUTH_SETUP_SECRET</code> in the API environment to a random value with at least 32 characters, then restart the API.</span></div>}
            {isSetup && <>
              <label>Your name<input required maxLength="120" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
              <label>One-time setup secret<input required type="password" autoComplete="off" value={setupSecret} onChange={(event) => setSetupSecret(event.target.value)} /></label>
            </>}
            <label>Email address<input required type="email" maxLength="254" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input required type="password" minLength={isSetup ? 12 : undefined} maxLength="128" autoComplete={isSetup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {isSetup && <label>Confirm password<input required type="password" minLength="12" maxLength="128" autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} /></label>}
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={submitting || (isSetup && !setupAvailable)}>{submitting ? "Please wait…" : isSetup ? "Create administrator" : "Sign in"}</button>
          </form>
          </>
        )}
        {!isSetup && !isChecking && !startupError && <p className="auth-footnote">Contact your workspace administrator if you need help accessing your account.</p>}
      </section>
    </main>
  );
}

function ReportsPage({ report, loading, error, onLoad }) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);
  const [from, setFrom] = useState(() => localDateString(thirtyDaysAgo));
  const [to, setTo] = useState(() => localDateString(today));
  const [rangeError, setRangeError] = useState("");
  const maxRevenue = Math.max(1, ...(report?.daily || []).map((day) => day.revenue));
  const maxProductQuantity = Math.max(1, ...(report?.topProducts || []).map((item) => item.quantity));

  useEffect(() => {
    onLoad(from, to);
  }, []);

  function applyRange(event) {
    event.preventDefault();
    setRangeError("");
    if (!from || !to || from > to) {
      setRangeError("Choose a valid date range. The start date must be on or before the end date.");
      return;
    }
    onLoad(from, to);
  }

  function downloadCsv() {
    if (!report?.orderRows?.length) return;
    const columns = [
      ["Order number", "orderNumber"],
      ["Fulfilled date", "fulfilledAt"],
      ["Customer", "customer"],
      ["Product", "productName"],
      ["SKU", "sku"],
      ["Quantity", "quantity"],
      ["Unit price", "unitPrice"],
      ["Line total", "lineTotal"],
    ];
    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      columns.map(([label]) => escapeCell(label)).join(","),
      ...report.orderRows.map((row) => columns.map(([, key]) => escapeCell(row[key])).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sales-report-${report.from}-to-${report.to}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="content">
      <div className="page-heading report-heading">
        <div className="title-line"><h1>Reports</h1><span className="inventory-count">Sales overview</span></div>
        <p>Review fulfilled sales, daily revenue, and your best-selling products.</p>
      </div>
      <form className="report-filter" onSubmit={applyRange}>
        <label>From<input aria-label="Report start date" required type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input aria-label="Report end date" required type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="primary-button" type="submit" disabled={loading}><TrendingUp size={16} />{loading ? "Loading…" : "Apply dates"}</button>
        <button className="secondary-button export-button" type="button" onClick={downloadCsv} disabled={!report?.orderRows?.length}><Download size={15} /> Export CSV</button>
      </form>
      {rangeError && <p className="form-error report-range-error" role="alert">{rangeError}</p>}
      {error && <div className="report-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => onLoad(from, to)}>Retry</button></div>}
      {loading && !report ? <div className="empty-state"><span className="spinner" /><b>Loading sales report…</b></div> : report && (
        <>
          <div className="production-summary report-summary">
            <article className="production-stat"><span className="production-stat-icon completed-icon"><TrendingUp size={19} /></span><div><small>Sales revenue</small><b>${report.summary.revenue.toFixed(2)}</b></div></article>
            <article className="production-stat"><span className="production-stat-icon"><ShoppingCart size={19} /></span><div><small>Fulfilled orders</small><b>{report.summary.orderCount}</b></div></article>
            <article className="production-stat"><span className="production-stat-icon planned-icon"><Boxes size={19} /></span><div><small>Units sold</small><b>{report.summary.unitsSold}</b></div></article>
            <article className="production-stat"><span className="production-stat-icon"><FileSpreadsheet size={19} /></span><div><small>Average order</small><b>${report.summary.averageOrderValue.toFixed(2)}</b></div></article>
          </div>

          <div className="report-panels">
            <section className="production-card report-chart-card">
              <div className="production-card-header"><div><h2>Daily sales</h2><p>Revenue from orders fulfilled in the selected range.</p></div></div>
              {report.daily.length ? (
                <div className="daily-chart" role="img" aria-label={`Daily sales chart showing ${report.daily.length} days`}>
                  {report.daily.map((day) => (
                    <div className="chart-column" key={day.date} title={`${day.date}: $${day.revenue.toFixed(2)} · ${day.orders} orders`}>
                      <span className="chart-value">{day.revenue ? `$${day.revenue.toFixed(0)}` : ""}</span>
                      <div className="chart-bar-track"><div className="chart-bar" style={{ height: `${day.revenue ? Math.max(5, day.revenue / maxRevenue * 100) : 0}%` }} /></div>
                      <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state"><b>No sales in this period</b><p>Fulfilled orders will appear here.</p></div>}
            </section>
            <section className="production-card top-products-card">
              <div className="production-card-header"><div><h2>Top-selling products</h2><p>Ranked by units sold.</p></div></div>
              {report.topProducts.length ? <div className="top-products-list">{report.topProducts.map((product, index) => (
                <div className="top-product" key={`${product.sku}-${index}`}>
                  <div className="top-product-title"><span className="product-rank">{index + 1}</span><span className="top-product-name">{product.productName}<small>{product.sku}</small></span><b>{product.quantity} sold</b></div>
                  <div className="top-product-track"><span style={{ width: `${product.quantity / maxProductQuantity * 100}%` }} /></div>
                  <small className="top-product-revenue">${product.revenue.toFixed(2)} revenue</small>
                </div>
              ))}</div> : <div className="empty-state"><b>No product sales yet</b><p>Products from fulfilled orders will be ranked here.</p></div>}
            </section>
          </div>
          <section className="production-card report-detail-card">
            <div className="production-card-header"><div><h2>Fulfilled order details</h2><p>{report.orderRows.length} product line{report.orderRows.length === 1 ? "" : "s"} · {report.from} to {report.to}</p></div></div>
            {report.orderRows.length ? <div className="production-table-wrap"><table className="production-table report-details-table">
              <thead><tr><th>ORDER</th><th>FULFILLED</th><th>CUSTOMER</th><th>PRODUCT</th><th>SKU</th><th>QTY</th><th>UNIT PRICE</th><th>LINE TOTAL</th></tr></thead>
              <tbody>{report.orderRows.map((row, index) => <tr key={`${row.orderNumber}-${row.sku}-${index}`}>
                <td><code>{row.orderNumber}</code></td><td>{row.fulfilledAt}</td><td>{row.customer}</td><td>{row.productName}</td><td><code>{row.sku}</code></td><td>{row.quantity}</td><td>${row.unitPrice.toFixed(2)}</td><td><b>${row.lineTotal.toFixed(2)}</b></td>
              </tr>)}</tbody>
            </table></div> : <div className="empty-state"><FileSpreadsheet size={25} /><b>No fulfilled orders in this date range</b><p>Try a wider date range or fulfill a customer order.</p></div>}
          </section>
        </>
      )}
    </section>
  );
}

const defaultAppSettings = {
  businessName: "My business",
  contactEmail: "",
  phone: "",
  address: "",
  defaultLowStockThreshold: 5,
};

function SettingsPage({ settings, loading, error, onSave }) {
  const [form, setForm] = useState(settings || defaultAppSettings);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  async function submitSettings(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await onSave({
        ...form,
        defaultLowStockThreshold: Number(form.defaultLowStockThreshold),
      });
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content">
      <div className="page-heading settings-heading">
        <div className="title-line"><h1>Settings</h1><span className="inventory-count">Workspace preferences</span></div>
        <p>Configure your business profile and default inventory alerts.</p>
      </div>
      {loading && !settings ? <div className="empty-state"><span className="spinner" /><b>Loading workspace settings…</b></div> : error && !settings ? (
        <div className="report-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>
      ) : (
        <>
          {error && <div className="report-error" role="alert"><AlertTriangle size={17} /><span>Settings could not be refreshed: {error}</span></div>}
          <form className="production-card settings-card" onSubmit={submitSettings}>
            <div className="production-card-header"><div><h2>Business profile</h2><p>These details identify your workspace in the application.</p></div></div>
            <div className="settings-form">
              <label>Business name<input required maxLength="120" value={form.businessName} onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))} /></label>
              <div className="form-grid">
                <label>Contact email<input type="email" maxLength="254" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} placeholder="name@business.com" /></label>
                <label>Phone number<input type="tel" maxLength="40" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Optional" /></label>
              </div>
              <label>Business address<textarea maxLength="500" rows="3" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Optional" /></label>
            </div>
            <div className="settings-section">
              <div><h2>Inventory preferences</h2><p>The default alert level is used for new products. Updating it does not change existing products.</p></div>
              <label className="threshold-setting">Default low-stock threshold<input required type="number" min="0" max="2147483647" step="1" value={form.defaultLowStockThreshold} onChange={(event) => setForm((current) => ({ ...current, defaultLowStockThreshold: event.target.value }))} /><small>Show low-stock alerts when a product reaches this quantity. Individual products can have their own threshold.</small></label>
            </div>
            {formError && <p className="form-error settings-error" role="alert">{formError}</p>}
            <div className="settings-actions"><button className="primary-button" type="submit" disabled={saving || loading}>{saving ? "Saving…" : <><Check size={16} /> Save settings</>}</button></div>
          </form>
          <p className="inventory-footnote"><ShieldCheck size={14} /> Workspace settings are saved to your database.</p>
        </>
      )}
    </section>
  );
}

function DashboardPage({ data, loading, error, onRefresh, onNavigate }) {
  if (loading && !data) {
    return <section className="content"><div className="empty-state dashboard-loading"><span className="spinner" /><b>Loading business overview…</b></div></section>;
  }
  if (error && !data) {
    return <section className="content"><div className="page-heading dashboard-heading"><div className="title-line"><h1>Dashboard</h1></div><p>Your business overview at a glance.</p></div><div className="report-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={onRefresh}>Retry</button></div></section>;
  }

  const products = data?.products || [];
  const orders = data?.orders || [];
  const productionOrders = data?.productionOrders || [];
  const tickets = data?.tickets || [];
  const report = data?.report;
  const permissions = data?.permissions || {};
  const lowStockProducts = products.filter((product) => product.stock <= product.lowStockThreshold);
  const stockUnits = products.reduce((total, product) => total + product.stock, 0);
  const inventoryValue = products.reduce((total, product) => total + product.stock * product.unitPrice, 0);
  const openOrders = orders.filter((order) => order.status === "OPEN" || order.status === "PROCESSING");
  const plannedProduction = productionOrders.filter((order) => order.status === "PLANNED");
  const activeTickets = tickets.filter((ticket) => ticket.status !== "RESOLVED");
  const recentOrders = orders.slice(0, 5);
  const recentTickets = tickets.slice(0, 4);
  const daily = report?.daily || [];
  const maxRevenue = Math.max(1, ...daily.map((day) => day.revenue));

  return (
    <section className="content">
      <div className="page-heading dashboard-heading">
        <div className="dashboard-heading-row">
          <div><div className="title-line"><h1>Dashboard</h1><span className="inventory-count">Business overview</span></div><p>Monitor inventory, sales, production, and customer support.</p></div>
          <button className="secondary-button dashboard-refresh" type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? "refresh-spinning" : ""} />{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>

      {error && <div className="report-error dashboard-inline-error" role="alert"><AlertTriangle size={17} /><span>Some dashboard data could not be refreshed: {error}</span><button type="button" onClick={onRefresh}>Retry</button></div>}

      <div className="dashboard-stats">
        <button className="dashboard-stat" type="button" onClick={() => permissions.INVENTORY && onNavigate("Inventory")} disabled={!permissions.INVENTORY}>
          <span className="production-stat-icon"><Package size={19} /></span><span><small>Inventory items</small><b>{permissions.INVENTORY ? products.length : "—"}</b><em>{permissions.INVENTORY ? `${stockUnits.toLocaleString()} units in stock` : "No inventory access"}</em></span>{permissions.INVENTORY && <ArrowRight size={15} />}
        </button>
        <button className="dashboard-stat" type="button" onClick={() => permissions.INVENTORY && onNavigate("Inventory")} disabled={!permissions.INVENTORY}>
          <span className={`production-stat-icon ${lowStockProducts.length ? "planned-icon" : "completed-icon"}`}><CircleAlert size={19} /></span><span><small>Low / out of stock</small><b>{permissions.INVENTORY ? lowStockProducts.length : "—"}</b><em>{permissions.INVENTORY ? `${products.filter((product) => product.stock <= 0).length} out of stock` : "No inventory access"}</em></span>{permissions.INVENTORY && <ArrowRight size={15} />}
        </button>
        <button className="dashboard-stat" type="button" onClick={() => permissions.REPORTS && onNavigate("Report")} disabled={!permissions.REPORTS}>
          <span className="production-stat-icon completed-icon"><TrendingUp size={19} /></span><span><small>Sales · last 14 days</small><b>{permissions.REPORTS ? `$${(report?.summary.revenue || 0).toFixed(2)}` : "—"}</b><em>{permissions.REPORTS ? `${report?.summary.orderCount || 0} fulfilled orders` : "No report access"}</em></span>{permissions.REPORTS && <ArrowRight size={15} />}
        </button>
        <button className="dashboard-stat" type="button" onClick={() => permissions.ORDERS && onNavigate("Order")} disabled={!permissions.ORDERS}>
          <span className="production-stat-icon planned-icon"><ShoppingCart size={19} /></span><span><small>Orders to fulfill</small><b>{permissions.ORDERS ? openOrders.length : "—"}</b><em>{permissions.ORDERS ? "Open or processing" : "No order access"}</em></span>{permissions.ORDERS && <ArrowRight size={15} />}
        </button>
      </div>

      <div className="dashboard-grid">
        <section className="production-card dashboard-sales-card">
          <div className="production-card-header"><div><h2>Sales trend</h2><p>Daily revenue over the last 14 days · inventory value {permissions.INVENTORY ? `$${inventoryValue.toFixed(2)}` : "restricted"}</p></div>{permissions.REPORTS && <button className="text-link-button" type="button" onClick={() => onNavigate("Report")}>View report <ArrowRight size={14} /></button>}</div>
          {!permissions.REPORTS ? <div className="empty-state dashboard-small-empty"><b>Sales trend unavailable</b><p>Your account does not have report access.</p></div> : daily.length ? <div className="dashboard-chart" role="img" aria-label="Daily sales revenue over the last 14 days">{daily.map((day) => (
            <div className="dashboard-chart-column" key={day.date} title={`${day.date}: $${day.revenue.toFixed(2)} · ${day.orders} orders`}>
              <div className="dashboard-chart-track"><span style={{ height: `${day.revenue ? Math.max(4, day.revenue / maxRevenue * 100) : 0}%` }} /></div>
              <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
            </div>
          ))}</div> : <div className="empty-state dashboard-small-empty"><b>No fulfilled sales yet</b><p>Sales will appear here after orders are fulfilled.</p></div>}
        </section>

        <section className="production-card dashboard-operations-card">
          <div className="production-card-header"><div><h2>Operations</h2><p>Items that may need attention.</p></div></div>
          {permissions.PRODUCTION && <button className="dashboard-operation" type="button" onClick={() => onNavigate("Production")}><span className="operation-icon production-operation-icon"><Factory size={17} /></span><span><b>Planned production</b><small>Orders waiting to be completed</small></span><strong>{plannedProduction.length}</strong></button>}
          {permissions.SUPPORT && <button className="dashboard-operation" type="button" onClick={() => onNavigate("Support")}><span className="operation-icon support-operation-icon"><CircleHelp size={17} /></span><span><b>Active support tickets</b><small>Open or in progress</small></span><strong>{activeTickets.length}</strong></button>}
          {permissions.INVENTORY && <button className="dashboard-operation" type="button" onClick={() => onNavigate("Inventory")}><span className="operation-icon stock-operation-icon"><AlertTriangle size={17} /></span><span><b>Inventory at risk</b><small>At or below low-stock threshold</small></span><strong>{lowStockProducts.length}</strong></button>}
        </section>

        {permissions.ORDERS && <section className="production-card dashboard-list-card">
          <div className="production-card-header"><div><h2>Recent orders</h2><p>Latest customer orders and fulfillment status.</p></div><button className="text-link-button" type="button" onClick={() => onNavigate("Order")}>All orders <ArrowRight size={14} /></button></div>
          {recentOrders.length ? <div className="dashboard-list">{recentOrders.map((order) => (
            <button className="dashboard-list-row" type="button" key={order.id} onClick={() => onNavigate("Order")}>
              <span className="dashboard-list-main"><b>SO-{String(order.id).padStart(5, "0")} · {order.customer}</b><small>{new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item{order.items.length === 1 ? "" : "s"}</small></span>
              <span className={`order-status ${order.status.toLowerCase()}`}>{order.status === "FULFILLED" ? "Fulfilled" : order.status === "PROCESSING" ? "Processing" : order.status === "CANCELLED" ? "Cancelled" : "Open"}</span>
              <strong>${order.totalAmount.toFixed(2)}</strong>
            </button>
          ))}</div> : <div className="empty-state dashboard-small-empty"><b>No orders yet</b><p>New customer orders will appear here.</p></div>}
        </section>}

        {permissions.SUPPORT && <section className="production-card dashboard-list-card">
          <div className="production-card-header"><div><h2>Support inbox</h2><p>Latest customer support requests.</p></div><button className="text-link-button" type="button" onClick={() => onNavigate("Support")}>Support <ArrowRight size={14} /></button></div>
          {recentTickets.length ? <div className="dashboard-list">{recentTickets.map((ticket) => (
            <button className="dashboard-list-row dashboard-ticket-row" type="button" key={ticket.id} onClick={() => onNavigate("Support")}>
              <span className="dashboard-list-main"><b>{ticket.subject}</b><small>{ticket.requester} · {new Date(ticket.updatedAt).toLocaleDateString()}</small></span>
              <span className={`order-status ${ticket.status.toLowerCase()}`}>{ticket.status === "IN_PROGRESS" ? "In progress" : ticket.status === "RESOLVED" ? "Resolved" : "Open"}</span>
              <span className={`support-priority ${ticket.priority.toLowerCase()}`}>{ticket.priority.toLowerCase()}</span>
            </button>
          ))}</div> : <div className="empty-state dashboard-small-empty"><b>No support tickets</b><p>New requests will appear here.</p></div>}
        </section>}
      </div>
    </section>
  );
}

const supportCategoryLabels = {
  GENERAL: "General",
  ACCOUNT: "Account",
  INVENTORY: "Inventory",
  PRODUCTION: "Production",
  ORDERS: "Orders",
  TECHNICAL: "Technical",
};

const supportStatusLabels = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

function supportTicketNumber(id) {
  return `SUP-${String(id).padStart(5, "0")}`;
}

function SupportPage({ tickets, loading, error, onLoad, onCreate, onUpdateStatus, onReply }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [form, setForm] = useState({
    requester: "",
    email: "",
    category: "GENERAL",
    priority: "NORMAL",
    subject: "",
    description: "",
  });
  const openCount = tickets.filter((ticket) => ticket.status === "OPEN").length;
  const progressCount = tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === "RESOLVED").length;
  const filteredTickets = tickets.filter((ticket) => {
    const matchesQuery = `${ticket.subject} ${ticket.requester} ${ticket.email} ${supportTicketNumber(ticket.id)}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesQuery && (statusFilter === "ALL" || ticket.status === statusFilter);
  });

  function openCreate() {
    setForm({ requester: "", email: "", category: "GENERAL", priority: "NORMAL", subject: "", description: "" });
    setFormError("");
    setCreateOpen(true);
  }

  async function submitTicket(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await onCreate(form);
      setCreateOpen(false);
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(ticket, status) {
    setActionError("");
    try {
      const updated = await onUpdateStatus(ticket.id, status);
      setSelectedTicket((current) => current?.id === updated.id ? updated : current);
    } catch (statusError) {
      setActionError(statusError.message);
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    if (!selectedTicket) return;
    setReplying(true);
    setActionError("");
    try {
      const updated = await onReply(selectedTicket.id, reply);
      setSelectedTicket(updated);
      setReply("");
    } catch (replyError) {
      setActionError(replyError.message);
    } finally {
      setReplying(false);
    }
  }

  return (
    <section className="content">
      <div className="page-heading support-heading">
        <div className="title-line"><h1>Support</h1><span className="inventory-count">Help desk</span></div>
        <p>Track support requests, keep customers updated, and resolve issues.</p>
      </div>
      <div className="production-summary support-summary">
        <article className="production-stat"><span className="production-stat-icon"><MessageSquare size={19} /></span><div><small>Total tickets</small><b>{tickets.length}</b></div></article>
        <article className="production-stat"><span className="production-stat-icon planned-icon"><Clock size={19} /></span><div><small>Open / in progress</small><b>{openCount + progressCount}</b></div></article>
        <article className="production-stat"><span className="production-stat-icon completed-icon"><Check size={19} /></span><div><small>Resolved</small><b>{resolvedCount}</b></div></article>
      </div>
      <section className="production-card support-card">
        <div className="production-card-header">
          <div><h2>Support tickets</h2><p>Review requests and reply to customers.</p></div>
          <button className="primary-button" type="button" onClick={openCreate}><Plus size={16} /> New ticket</button>
        </div>
        <div className="support-toolbar">
          <label className="search-field"><Search size={17} /><input aria-label="Search support tickets" placeholder="Search subject, requester, or ticket ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="select-control"><select aria-label="Filter tickets by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select><ChevronDown size={16} /></label>
        </div>
        {loading && <div className="empty-state"><span className="spinner" /><b>Loading support tickets…</b></div>}
        {!loading && error && <div className="empty-state error-state"><AlertTriangle size={25} /><b>Could not load support tickets</b><p>{error}</p><button className="secondary-button" type="button" onClick={onLoad}>Retry</button></div>}
        {!loading && !error && actionError && <p className="form-error support-action-error" role="alert">{actionError}</p>}
        {!loading && !error && filteredTickets.length === 0 && (
          <div className="empty-state"><MessageSquare size={27} /><b>{tickets.length ? "No matching tickets" : "No support tickets yet"}</b><p>{tickets.length ? "Try another search or status filter." : "Create a ticket to start tracking a customer request."}</p></div>
        )}
        {!loading && !error && filteredTickets.length > 0 && (
          <div className="production-table-wrap">
            <table className="production-table support-table">
              <thead><tr><th>TICKET</th><th>REQUESTER</th><th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th><th>UPDATED</th><th>ACTION</th></tr></thead>
              <tbody>{filteredTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td><div className="support-subject"><code>{supportTicketNumber(ticket.id)}</code><b>{ticket.subject}</b></div></td>
                  <td><div className="support-requester"><b>{ticket.requester}</b><small>{ticket.email}</small></div></td>
                  <td>{supportCategoryLabels[ticket.category] || ticket.category}</td>
                  <td><span className={`support-priority ${ticket.priority.toLowerCase()}`}>{ticket.priority.toLowerCase()}</span></td>
                  <td><span className={`order-status ${ticket.status.toLowerCase()}`}>{supportStatusLabels[ticket.status] || ticket.status}</span></td>
                  <td><span className="support-date">{new Date(ticket.updatedAt).toLocaleDateString()}</span></td>
                  <td><button className="user-action-button" type="button" onClick={() => { setSelectedTicket(ticket); setReply(""); setActionError(""); }}>View ticket</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <section className="modal support-modal" role="dialog" aria-modal="true" aria-labelledby="support-create-title">
            <div className="modal-header"><div><h2 id="support-create-title">Create support ticket</h2><p>Record a customer request for your team to follow up.</p></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={() => setCreateOpen(false)}><X size={19} /></button></div>
            <form className="modal-form support-form" onSubmit={submitTicket}>
              <label>Requester name<input required maxLength="120" value={form.requester} onChange={(event) => setForm((current) => ({ ...current, requester: event.target.value }))} /></label>
              <label>Email address<input required type="email" maxLength="254" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <div className="form-grid">
                <label>Category<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}><option value="GENERAL">General</option><option value="ACCOUNT">Account</option><option value="INVENTORY">Inventory</option><option value="PRODUCTION">Production</option><option value="ORDERS">Orders</option><option value="TECHNICAL">Technical</option></select></label>
                <label>Priority<select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
              </div>
              <label>Subject<input required maxLength="160" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} /></label>
              <label>Describe the issue<textarea required maxLength="4000" rows="5" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Creating…" : "Create ticket"}</button></div>
            </form>
          </section>
        </div>
      )}

      {selectedTicket && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTicket(null); }}>
          <section className="modal support-modal support-detail-modal" role="dialog" aria-modal="true" aria-labelledby="support-detail-title">
            <div className="modal-header"><div><h2 id="support-detail-title">{supportTicketNumber(selectedTicket.id)} · {selectedTicket.subject}</h2><p>Submitted by {selectedTicket.requester} · {selectedTicket.email}</p></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={() => setSelectedTicket(null)}><X size={19} /></button></div>
            <div className="support-detail-body">
              <div className="support-detail-meta">
                <span className={`support-priority ${selectedTicket.priority.toLowerCase()}`}>{selectedTicket.priority.toLowerCase()} priority</span>
                <label>Status<select aria-label="Ticket status" value={selectedTicket.status} onChange={(event) => changeStatus(selectedTicket, event.target.value)}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select></label>
              </div>
              <div className="support-description"><small>{supportCategoryLabels[selectedTicket.category] || selectedTicket.category} · {new Date(selectedTicket.createdAt).toLocaleString()}</small><p>{selectedTicket.description}</p></div>
              <div className="support-replies"><h3>Conversation</h3>{selectedTicket.replies.length ? selectedTicket.replies.map((item) => <article className="support-reply" key={item.id}><div><b>{item.author}</b><small>{new Date(item.createdAt).toLocaleString()}</small></div><p>{item.message}</p></article>) : <p className="support-no-replies">No replies yet. Send a response to update the customer.</p>}</div>
              <form className="support-reply-form" onSubmit={submitReply}><label htmlFor="support-reply">Reply as Support team</label><textarea id="support-reply" required maxLength="2000" rows="3" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a helpful response…" />{actionError && <p className="form-error" role="alert">{actionError}</p>}<button className="primary-button" type="submit" disabled={replying}>{replying ? "Sending…" : <><Send size={15} /> Send reply</>}</button></form>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

const userModules = [
  { key: "DASHBOARD", label: "Dashboard" },
  { key: "INVENTORY", label: "Inventory" },
  { key: "PRODUCTION", label: "Production" },
  { key: "ORDERS", label: "Orders" },
  { key: "REPORTS", label: "Reports" },
  { key: "USER_ACCESS", label: "User access" },
  { key: "SUPPORT", label: "Support" },
  { key: "SETTINGS", label: "Settings" },
];

const defaultRolePermissions = {
  ADMIN: { DASHBOARD: true, INVENTORY: true, PRODUCTION: true, ORDERS: true, REPORTS: true, USER_ACCESS: true, SUPPORT: true, SETTINGS: true },
  MANAGER: { DASHBOARD: true, INVENTORY: true, PRODUCTION: true, ORDERS: true, REPORTS: true, USER_ACCESS: false, SUPPORT: true, SETTINGS: true },
  STAFF: { DASHBOARD: true, INVENTORY: true, PRODUCTION: false, ORDERS: true, REPORTS: false, USER_ACCESS: false, SUPPORT: true, SETTINGS: false },
};

function emptyUserForm() {
  return {
    fullName: "",
    email: "",
    role: "STAFF",
    status: "ACTIVE",
    password: "",
    passwordConfirm: "",
    permissions: { ...defaultRolePermissions.STAFF },
  };
}

function UserAccessPage({ users, loading, error, currentUserId, onSave, onDelete, onToggleStatus }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [userToEdit, setUserToEdit] = useState(null);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const invitedCount = users.filter((user) => user.status === "INVITED").length;
  const filteredUsers = users.filter((user) => {
    const matchesQuery = `${user.fullName} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (roleFilter === "ALL" || user.role === roleFilter);
  });

  function openCreate() {
    setUserToEdit(null);
    setForm(emptyUserForm());
    setFormError("");
  }

  function openEdit(user) {
    setUserToEdit(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      password: "",
      passwordConfirm: "",
      permissions: { ...user.permissions },
    });
    setFormError("");
  }

  function changeRole(role) {
    setForm((current) => ({
      ...current,
      role,
      permissions: { ...defaultRolePermissions[role] },
    }));
  }

  async function submitUser(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (form.password && form.password !== form.passwordConfirm) {
        throw new Error("The passwords do not match.");
      }
      const { passwordConfirm, ...userInput } = form;
      await onSave(userInput, userToEdit?.id);
      setForm(null);
      setUserToEdit(null);
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content">
      <div className="page-heading access-heading">
        <div className="title-line"><h1>User Access</h1><span className="inventory-count">Team & permissions</span></div>
        <p>Manage team profiles, assign roles, and configure module access.</p>
      </div>
      <div className="access-notice" role="note">
        <ShieldCheck size={17} />
        <span>Passwords are securely hashed. Users must have Active status and a password to sign in.</span>
      </div>
      <div className="production-summary access-summary">
        <article className="production-stat"><span className="production-stat-icon"><Users size={19} /></span><div><small>Total team members</small><b>{users.length}</b></div></article>
        <article className="production-stat"><span className="production-stat-icon completed-icon"><Check size={19} /></span><div><small>Active</small><b>{activeCount}</b></div></article>
        <article className="production-stat"><span className="production-stat-icon planned-icon"><Mail size={19} /></span><div><small>Invited</small><b>{invitedCount}</b></div></article>
      </div>
      <section className="production-card access-card">
        <div className="production-card-header">
          <div><h2>Team members</h2><p>Assign a role and customize access to each ERP module.</p></div>
          <button className="primary-button" type="button" onClick={openCreate}><UserPlus size={16} /> Add team member</button>
        </div>
        <div className="access-toolbar">
          <label className="search-field"><Search size={17} /><input aria-label="Search team members" placeholder="Search name or email" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="select-control"><select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="ALL">All roles</option><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="STAFF">Staff</option></select><ChevronDown size={16} /></label>
        </div>
        {loading && <div className="empty-state"><span className="spinner" /><b>Loading team members…</b></div>}
        {!loading && error && <div className="empty-state error-state"><AlertTriangle size={25} /><b>Could not load user access</b><p>{error}</p></div>}
        {!loading && !error && filteredUsers.length === 0 && (
          <div className="empty-state"><Users size={27} /><b>{users.length ? "No matching team members" : "No team members yet"}</b><p>{users.length ? "Try another search or role filter." : "Add a team member to configure their role and module access."}</p></div>
        )}
        {!loading && !error && filteredUsers.length > 0 && (
          <div className="production-table-wrap">
            <table className="production-table user-table">
              <thead><tr><th>TEAM MEMBER</th><th>ROLE</th><th>MODULE ACCESS</th><th>STATUS</th><th>ACTION</th></tr></thead>
              <tbody>{filteredUsers.map((user) => {
                const enabledModules = userModules.filter((module) => user.permissions[module.key]).map((module) => module.label);
                return <tr key={user.id}>
                  <td><div className="user-identity"><span className="user-avatar">{user.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><b>{user.fullName}</b><small>{user.email}</small></span></div></td>
                  <td><span className={`role-badge ${user.role.toLowerCase()}`}>{user.role === "ADMIN" ? "Admin" : user.role === "MANAGER" ? "Manager" : "Staff"}</span></td>
                  <td><div className="module-chips">{enabledModules.length ? enabledModules.map((module) => <span key={module}>{module}</span>) : <small>No modules assigned</small>}</div></td>
                  <td><span className={`user-status ${user.status.toLowerCase()}`}><i />{user.status === "ACTIVE" ? "Active" : user.status === "INVITED" ? "Invited" : "Disabled"}</span></td>
                  <td><div className="user-actions">
                    <button className="user-action-button" type="button" onClick={() => openEdit(user)}><Pencil size={14} /> Edit</button>
                    <button className="user-action-button" type="button" onClick={() => onToggleStatus(user)}>{user.status === "DISABLED" ? "Enable" : "Disable"}</button>
                    <button className="user-remove-button" type="button" aria-label={`Remove ${user.fullName}`} onClick={() => onDelete(user)} disabled={user.id === currentUserId}><Trash2 size={15} /></button>
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {form && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setForm(null); setUserToEdit(null); } }}>
          <section className="modal user-access-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
            <div className="modal-header"><div><h2 id="user-modal-title">{userToEdit ? "Edit team member" : "Add team member"}</h2><p>Set an account profile and module permissions.</p></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={() => { setForm(null); setUserToEdit(null); }}><X size={19} /></button></div>
            <form className="modal-form user-form" onSubmit={submitUser}>
              <label>Full name<input required maxLength="120" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
              <label>Email address<input required type="email" maxLength="254" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
              {userToEdit?.id !== currentUserId && <>
                <label>{userToEdit ? "Set or change password (optional)" : "Initial password"}<input required={!userToEdit} type="password" autoComplete="new-password" minLength="12" maxLength="128" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={userToEdit ? "Leave blank to keep current password" : "At least 12 characters"} /></label>
                <label>Confirm password<input required={!userToEdit || Boolean(form.password)} type="password" autoComplete="new-password" minLength="12" maxLength="128" value={form.passwordConfirm} onChange={(event) => setForm((current) => ({ ...current, passwordConfirm: event.target.value }))} /></label>
              </>}
              <div className="form-grid">
                <label>Role<select value={form.role} onChange={(event) => changeRole(event.target.value)}><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="STAFF">Staff</option></select></label>
                <label>Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">Active</option><option value="INVITED">Invited</option><option value="DISABLED">Disabled</option></select></label>
              </div>
              <fieldset className="permission-fieldset">
                <legend>Module permissions</legend>
                <p>Role defaults are applied when you choose a role. Customize them below.</p>
                {userModules.map((module) => <label className="permission-row" key={module.key}>
                  <span><b>{module.label}</b><small>{module.key === "USER_ACCESS" && form.role !== "ADMIN" ? "Available to administrator accounts only" : `Allow access to ${module.label.toLowerCase()} module`}</small></span>
                  <input type="checkbox" checked={Boolean(form.permissions[module.key])} disabled={module.key === "USER_ACCESS" && form.role !== "ADMIN"} onChange={(event) => setForm((current) => ({ ...current, permissions: { ...current.permissions, [module.key]: event.target.checked } }))} />
                </label>)}
              </fieldset>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => { setForm(null); setUserToEdit(null); }}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : userToEdit ? "Save changes" : "Add team member"}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("checking");
  const [authSetupAvailable, setAuthSetupAvailable] = useState(false);
  const [authStartupError, setAuthStartupError] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authActionError, setAuthActionError] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [currentView, setCurrentView] = useState("Dashboard");
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionError, setProductionError] = useState("");
  const [salesOrdersLoading, setSalesOrdersLoading] = useState(false);
  const [salesOrdersError, setSalesOrdersError] = useState("");
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [teamMembersError, setTeamMembersError] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [salesReport, setSalesReport] = useState(null);
  const [salesReportLoading, setSalesReportLoading] = useState(false);
  const [salesReportError, setSalesReportError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [stockFilter, setStockFilter] = useState("All stock");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState("");
  const [chosen, setChosen] = useState(null);
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "Finished Good",
    incoming: "0",
    stock: "0",
    unitPrice: "",
    lowStockThreshold: "5",
  });
  const pageSize = 10;

  async function loadProducts() {
    setLoading(true);
    setLoadError("");
    try {
      const result = await api("/products");
      setProducts(result);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProductionOrders() {
    setProductionLoading(true);
    setProductionError("");
    try {
      setOrders(await api("/production/orders"));
    } catch (error) {
      setProductionError(error.message);
    } finally {
      setProductionLoading(false);
    }
  }

  async function loadSalesOrders() {
    setSalesOrdersLoading(true);
    setSalesOrdersError("");
    try {
      setSalesOrders(await api("/orders"));
    } catch (error) {
      setSalesOrdersError(error.message);
    } finally {
      setSalesOrdersLoading(false);
    }
  }

  async function loadTeamMembers() {
    setTeamMembersLoading(true);
    setTeamMembersError("");
    try {
      setTeamMembers(await api("/users"));
    } catch (error) {
      setTeamMembersError(error.message);
    } finally {
      setTeamMembersLoading(false);
    }
  }

  async function loadSupportTickets() {
    setSupportLoading(true);
    setSupportError("");
    try {
      setSupportTickets(await api("/support/tickets"));
    } catch (error) {
      setSupportError(error.message);
    } finally {
      setSupportLoading(false);
    }
  }

  async function loadAppSettings() {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      setAppSettings(await api("/settings"));
    } catch (error) {
      setSettingsError(error.message);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function loadSalesReport(from, to) {
    setSalesReportLoading(true);
    setSalesReportError("");
    setSalesReport(null);
    try {
      const params = new URLSearchParams({ from, to });
      setSalesReport(await api(`/reports/sales?${params.toString()}`));
    } catch (error) {
      setSalesReport(null);
      setSalesReportError(error.message);
    } finally {
      setSalesReportLoading(false);
    }
  }

  async function loadDashboard(user = authUser) {
    setDashboardLoading(true);
    setDashboardError("");
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 13);
    const from = localDateString(fromDate);
    const to = localDateString(today);
    try {
      const params = new URLSearchParams({ from, to });
      const permissions = user?.permissions || {};
      const [nextProducts, nextOrders, nextProductionOrders, nextTickets, report, settings] = await Promise.all([
        permissions.INVENTORY ? api("/products") : Promise.resolve([]),
        permissions.ORDERS ? api("/orders") : Promise.resolve([]),
        permissions.PRODUCTION ? api("/production/orders") : Promise.resolve([]),
        permissions.SUPPORT ? api("/support/tickets") : Promise.resolve([]),
        permissions.REPORTS ? api(`/reports/sales?${params.toString()}`) : Promise.resolve(null),
        permissions.SETTINGS ? api("/settings") : Promise.resolve(null),
      ]);
      setProducts(nextProducts);
      setSalesOrders(nextOrders);
      setOrders(nextProductionOrders);
      setSupportTickets(nextTickets);
      setAppSettings(settings);
      setDashboardData({
        products: nextProducts,
        orders: nextOrders,
        productionOrders: nextProductionOrders,
        tickets: nextTickets,
        report,
        permissions,
      });
      if (settings) {
        setAppSettings(settings);
        setSettingsError("");
      }
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function restoreAuthentication() {
    setAuthMode("checking");
    setAuthStartupError("");
    try {
      const status = await api("/auth/status");
      setAuthSetupAvailable(status.setupAvailable);
      if (status.setupRequired) {
        setAuthMode("setup");
        return;
      }
      try {
        const user = await api("/auth/me");
        setAuthUser(user);
        setAuthMode("app");
        await loadDashboard(user);
      } catch (error) {
        if (error.status === 401) {
          setAuthMode("login");
        } else {
          throw error;
        }
      }
    } catch (error) {
      setAuthStartupError(error.message);
      setAuthMode("error");
    }
  }

  async function submitAuthentication(mode, credentials) {
    const user = await api(`/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setAuthUser(user);
    setAuthMode("app");
    setCurrentView("Dashboard");
    setAuthActionError("");
    await loadDashboard(user);
  }

  async function logout() {
    setLoggingOut(true);
    setAuthActionError("");
    try {
      await api("/auth/logout", { method: "POST" });
      setAuthUser(null);
      setProfileMenuOpen(false);
      setDashboardData(null);
      setProducts([]);
      setOrders([]);
      setSalesOrders([]);
      setSupportTickets([]);
      setAppSettings(null);
      setAuthMode("login");
      setCurrentView("Dashboard");
    } catch (error) {
      setAuthActionError(error.message);
    } finally {
      setLoggingOut(false);
    }
  }

  useEffect(() => {
    restoreAuthentication();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort(),
    [products],
  );
  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const matchesQuery = `${product.name} ${product.sku}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesCategory =
          category === "All categories" || product.category === category;
        const status = stockStatus(product);
        const matchesStock =
          stockFilter === "All stock" ||
          (stockFilter === "Low stock" && status.className === "low") ||
          (stockFilter === "Out of stock" && status.className === "out");
        return matchesQuery && matchesCategory && matchesStock;
      }),
    [products, query, category, stockFilter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function openAddModal() {
    setActionError("");
    setForm({
      name: "",
      sku: "",
      category: "Finished Good",
      incoming: "0",
      stock: "0",
      unitPrice: "",
      lowStockThreshold: String(appSettings?.defaultLowStockThreshold ?? defaultAppSettings.defaultLowStockThreshold),
    });
    setModal("add");
  }

  async function addProduct(event) {
    event.preventDefault();
    setActionError("");
    try {
      const product = await api("/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          incoming: Number(form.incoming),
          stock: Number(form.stock),
          unitPrice: Number(form.unitPrice),
          lowStockThreshold: Number(form.lowStockThreshold),
        }),
      });
      setProducts((current) => [product, ...current]);
      setModal("");
      setPage(1);
      setNotice("Product added to inventory");
    } catch (error) {
      setActionError(error.message);
    }
  }

  async function recordSale(event) {
    event.preventDefault();
    if (!chosen) return;
    setActionError("");
    try {
      const updated = await api(`/products/${chosen.id}/sales`, {
        method: "POST",
        body: JSON.stringify({ quantity: Number(saleQuantity) }),
      });
      setProducts((current) =>
        current.map((product) => (product.id === updated.id ? updated : product)),
      );
      setModal("");
      setChosen(null);
      setNotice("Sale recorded");
    } catch (error) {
      setActionError(error.message);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete ${product.name} from inventory?`)) return;
    try {
      await api(`/products/${product.id}`, { method: "DELETE" });
      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );
      setSelectedIds((current) => current.filter((id) => id !== product.id));
      setNotice("Product deleted");
    } catch (error) {
      setNotice(`Could not delete product: ${error.message}`);
    }
  }

  async function deleteSelected() {
    if (!window.confirm(`Delete ${selectedIds.length} selected products?`)) return;
    const results = await Promise.allSettled(
      selectedIds.map((id) => api(`/products/${id}`, { method: "DELETE" })),
    );
    const deleted = selectedIds.filter((_, index) => results[index].status === "fulfilled");
    const failed = results.length - deleted.length;
    setProducts((current) => current.filter((product) => !deleted.includes(product.id)));
    setSelectedIds([]);
    setNotice(
      failed
        ? `${deleted.length} deleted; ${failed} could not be deleted. Refreshing inventory.`
        : `${deleted.length} products deleted`,
    );
    if (failed) await loadProducts();
  }

  async function createProductionOrder(orderInput) {
    const order = await api("/production/orders", {
      method: "POST",
      body: JSON.stringify(orderInput),
    });
    setOrders((current) => [order, ...current]);
    setNotice("Production order created");
  }

  async function completeProductionOrder(orderId) {
    let order;
    try {
      order = await api(`/production/orders/${orderId}/complete`, { method: "POST" });
    } catch (error) {
      setNotice(`Could not complete production: ${error.message}`);
      return;
    }
    setOrders((current) => current.map((item) => item.id === order.id ? order : item));
    setNotice(`Production completed · ${order.quantity} ${order.outputProduct.name} added to stock`);
    if (authUser.permissions.INVENTORY) {
      try {
        setProducts(await api("/products"));
      } catch (error) {
        setNotice(`Production completed, but inventory could not be refreshed: ${error.message}`);
      }
    }
  }

  async function cancelProductionOrder(orderId) {
    try {
      const order = await api(`/production/orders/${orderId}/cancel`, { method: "POST" });
      setOrders((current) => current.map((item) => item.id === order.id ? order : item));
      setNotice("Production order cancelled; inventory was not changed");
    } catch (error) {
      setNotice(`Could not cancel production: ${error.message}`);
    }
  }

  async function createSalesOrder(orderInput) {
    const order = await api("/orders", {
      method: "POST",
      body: JSON.stringify(orderInput),
    });
    setSalesOrders((current) => [order, ...current]);
    setNotice(`Order SO-${String(order.id).padStart(5, "0")} created`);
  }

  async function processSalesOrder(orderId) {
    try {
      const order = await api(`/orders/${orderId}/process`, { method: "POST" });
      setSalesOrders((current) => current.map((item) => item.id === order.id ? order : item));
      setNotice(`Order SO-${String(order.id).padStart(5, "0")} is processing`);
    } catch (error) {
      setNotice(`Could not process order: ${error.message}`);
    }
  }

  async function fulfillSalesOrder(orderId) {
    let order;
    try {
      order = await api(`/orders/${orderId}/fulfill`, { method: "POST" });
    } catch (error) {
      setNotice(`Could not fulfill order: ${error.message}`);
      await Promise.all([authUser.permissions.INVENTORY ? loadProducts() : Promise.resolve(), loadSalesOrders()]);
      return;
    }
    setSalesOrders((current) => current.map((item) => item.id === order.id ? order : item));
    setNotice(`Order SO-${String(order.id).padStart(5, "0")} fulfilled`);
    if (authUser.permissions.INVENTORY) {
      try {
        setProducts(await api("/products"));
      } catch (error) {
        setNotice(`Order fulfilled, but inventory could not be refreshed: ${error.message}`);
      }
    }
  }

  async function cancelSalesOrder(orderId) {
    try {
      const order = await api(`/orders/${orderId}/cancel`, { method: "POST" });
      setSalesOrders((current) => current.map((item) => item.id === order.id ? order : item));
      setNotice(`Order SO-${String(order.id).padStart(5, "0")} cancelled`);
    } catch (error) {
      setNotice(`Could not cancel order: ${error.message}`);
    }
  }

  async function saveTeamMember(userInput, userId) {
    const saved = await api(userId ? `/users/${userId}` : "/users", {
      method: userId ? "PATCH" : "POST",
      body: JSON.stringify(userInput),
    });
    setTeamMembers((current) => userId
      ? current.map((user) => user.id === saved.id ? saved : user)
      : [saved, ...current]);
    setAuthUser((current) => current?.id === saved.id ? saved : current);
    setNotice(userId ? "Team member updated" : "Team member added");
  }

  async function deleteTeamMember(user) {
    if (!window.confirm(`Remove ${user.fullName} from the team?`)) return;
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      setTeamMembers((current) => current.filter((item) => item.id !== user.id));
      setNotice(`${user.fullName} removed`);
    } catch (error) {
      setNotice(`Could not remove team member: ${error.message}`);
    }
  }

  async function toggleTeamMemberStatus(user) {
    const nextStatus = user.status === "DISABLED" ? "ACTIVE" : "DISABLED";
    try {
      const updated = await api(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...user, status: nextStatus }),
      });
      setTeamMembers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`${user.fullName} ${nextStatus === "ACTIVE" ? "enabled" : "disabled"}`);
    } catch (error) {
      setNotice(`Could not update team member: ${error.message}`);
    }
  }

  async function createSupportTicket(ticketInput) {
    const ticket = await api("/support/tickets", {
      method: "POST",
      body: JSON.stringify(ticketInput),
    });
    setSupportTickets((current) => [ticket, ...current]);
    setNotice(`${supportTicketNumber(ticket.id)} created`);
    return ticket;
  }

  async function updateSupportTicketStatus(ticketId, status) {
    const ticket = await api(`/support/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setSupportTickets((current) => current.map((item) => item.id === ticket.id ? ticket : item));
    setNotice(`${supportTicketNumber(ticket.id)} marked ${supportStatusLabels[ticket.status].toLowerCase()}`);
    return ticket;
  }

  async function replyToSupportTicket(ticketId, message) {
    const ticket = await api(`/support/tickets/${ticketId}/replies`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    setSupportTickets((current) => current.map((item) => item.id === ticket.id ? ticket : item));
    setNotice(`Reply sent to ${supportTicketNumber(ticket.id)}`);
    return ticket;
  }

  async function saveAppSettings(settingsInput) {
    const settings = await api("/settings", {
      method: "PATCH",
      body: JSON.stringify(settingsInput),
    });
    setAppSettings(settings);
    setNotice("Workspace settings saved");
    return settings;
  }

  function changeView(view) {
    const requiredPermission = {
      Dashboard: "DASHBOARD",
      Inventory: "INVENTORY",
      Production: "PRODUCTION",
      Order: "ORDERS",
      Report: "REPORTS",
      "User Access": "USER_ACCESS",
      Support: "SUPPORT",
      Setting: "SETTINGS",
    }[view];
    if (requiredPermission && !authUser?.permissions[requiredPermission]) return;
    if (view === "User Access" && authUser?.role !== "ADMIN") return;
    setCurrentView(view);
    if (view === "Dashboard") loadDashboard();
    if (view === "Production") loadProductionOrders();
    if (view === "Order") loadSalesOrders();
    if (view === "Inventory") loadProducts();
    if (view === "User Access") loadTeamMembers();
    if (view === "Support") loadSupportTickets();
    if (view === "Setting") loadAppSettings();
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  if (authMode !== "app" || !authUser) {
    return <AuthPage
      mode={authMode}
      setupAvailable={authSetupAvailable}
      startupError={authStartupError}
      onSubmit={submitAuthentication}
      onRetry={restoreAuthentication}
    />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Inventra home">
          <span className="brand-mark"><Boxes size={21} /></span>
          <span className="brand-name">Inventra</span>
        </a>
        <nav className="navigation" aria-label="Main navigation">
          {navigation.filter(({ label }) => {
            const permission = {
              Dashboard: "DASHBOARD",
              Inventory: "INVENTORY",
              Production: "PRODUCTION",
              Order: "ORDERS",
              Report: "REPORTS",
              "User Access": "USER_ACCESS",
              Support: "SUPPORT",
              Setting: "SETTINGS",
            }[label];
            return (!permission || authUser.permissions[permission]) && (label !== "User Access" || authUser.role === "ADMIN");
          }).map(({ label, icon: Icon }) => {
            const active = label === currentView;
            const available = ["Dashboard", "Inventory", "Production", "Order", "Report", "User Access", "Support", "Setting"].includes(label);
            return (
            <button
              className={`nav-item${active ? " active" : ""}`}
              key={label}
              type="button"
              disabled={!available}
              aria-current={active ? "page" : undefined}
              title={available ? label : `${label} module coming soon`}
              onClick={() => available && changeView(label)}
            >
              <Icon size={19} strokeWidth={2.1} />
              <span>{label}</span>
            </button>
          );})}
        </nav>
        <div className="sidebar-footer">
          <div className="workspace-card">
            <span className="workspace-icon"><Boxes size={15} /></span>
            <span><b>{appSettings?.businessName || "My business"}</b><small>Business workspace</small></span>
            <ChevronDown size={15} />
          </div>
          <small className="version">INVENTRA ERP · STARTER</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <b>{currentView}</b></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Messages" type="button"><Mail size={19} /></button>
            <button className="icon-button notification-button" aria-label="Notifications" type="button">
              <Bell size={19} /><span />
            </button>
            <span className="topbar-divider" />
            <div className="profile-menu-container">
              <button className="profile" type="button" aria-label="User profile" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => { setProfileMenuOpen((open) => !open); setAuthActionError(""); }}>
                <span>{authUser.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
              </button>
              {profileMenuOpen && <div className="profile-menu" role="menu">
                <div className="profile-menu-identity"><b>{authUser.fullName}</b><small>{authUser.email}</small><span>{authUser.role.charAt(0) + authUser.role.slice(1).toLowerCase()}</span></div>
                {authActionError && <p className="profile-menu-error" role="alert">{authActionError}</p>}
                <button type="button" role="menuitem" className="profile-logout" onClick={logout} disabled={loggingOut}><LogOut size={16} />{loggingOut ? "Signing out…" : "Sign out"}</button>
              </div>}
            </div>
          </div>
        </header>

        {currentView === "Dashboard" ? <DashboardPage
          data={dashboardData}
          loading={dashboardLoading}
          error={dashboardError}
          onRefresh={loadDashboard}
          onNavigate={changeView}
        /> : currentView === "Inventory" ? <section className="content">
          <div className="page-heading">
            <div className="title-line">
              <h1>Inventory</h1>
              <span className="inventory-count">({products.length} items)</span>
            </div>
            <p>Manage products, monitor stock levels, and keep your business moving.</p>
          </div>

          <div className="toolbar">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="Search inventory"
                placeholder="Search for inventory"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={15} />
                </button>
              )}
            </label>
            <div className="filter-control">
              <ClipboardList size={16} />
              <span>Filter</span>
            </div>
            <label className="select-control">
              <select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
                <option>All categories</option>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={16} />
            </label>
            <label className="select-control stock-select">
              <select aria-label="Filter by stock status" value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setPage(1); }}>
                <option>All stock</option>
                <option>Low stock</option>
                <option>Out of stock</option>
              </select>
              <ChevronDown size={16} />
            </label>
            <button className="primary-button" type="button" onClick={openAddModal}>
              <Plus size={18} /> Add Product
            </button>
            {selectedIds.length > 0 && (
              <button className="secondary-button bulk-delete" type="button" onClick={deleteSelected}>
                <Trash2 size={15} /> Delete selected ({selectedIds.length})
              </button>
            )}
          </div>

          <div className="table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="check-cell"><input aria-label="Select all products on this page" type="checkbox" checked={pageItems.length > 0 && pageItems.every((product) => selectedIds.includes(product.id))} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, ...pageItems.map((product) => product.id)])] : current.filter((id) => !pageItems.some((product) => product.id === id)))} /></th>
                    <th>ITEM</th>
                    <th>CATEGORY</th>
                    <th>SKU</th>
                    <th>INCOMING</th>
                    <th>STOCK</th>
                    <th>UNIT PRICE</th>
                    <th className="action-heading">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((product) => {
                    const status = stockStatus(product);
                    return (
                      <tr key={product.id}>
                        <td className="check-cell"><input aria-label={`Select ${product.name}`} type="checkbox" checked={selectedIds.includes(product.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /></td>
                        <td>
                          <div className="product-cell">
                            <span className="product-image"><Package size={19} /></span>
                            <b>{product.name}</b>
                          </div>
                        </td>
                        <td>{product.category}</td>
                        <td><code>{product.sku}</code></td>
                        <td>{product.incoming}</td>
                        <td>
                          <span className="stock-value">{product.stock}</span>
                          {status.className !== "good" && <span className={`stock-label ${status.className}`}>{status.label}</span>}
                        </td>
                        <td>${product.unitPrice.toFixed(2)}</td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-button row-menu" type="button" aria-label={`More actions for ${product.name}`} onClick={() => { setChosen(product); setSaleQuantity("1"); setActionError(""); setModal("sale"); }} disabled={product.stock < 1}>
                              <MoreHorizontal size={19} />
                            </button>
                            <button className="icon-button row-delete" type="button" aria-label={`Delete ${product.name}`} onClick={() => deleteProduct(product)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loading && !loadError && pageItems.length === 0 && (
                <div className="empty-state">
                  <Package size={27} />
                  <b>{products.length ? "No matching inventory" : "Your inventory is empty"}</b>
                  <p>{products.length ? "Try a different search or filter." : "Add your first product to start tracking stock."}</p>
                </div>
              )}
              {loading && <div className="empty-state"><span className="spinner" /><b>Loading inventory…</b></div>}
              {loadError && (
                <div className="empty-state error-state">
                  <AlertTriangle size={25} />
                  <b>Could not load inventory</b>
                  <p>{loadError}. Make sure the Node API is running.</p>
                  <button className="secondary-button" type="button" onClick={loadProducts}>Try again</button>
                </div>
              )}
            </div>
            <footer className="table-footer">
              <span className="rows-per-page">Show 10 rows <ChevronDown size={15} /></span>
              <span className="result-count">
                {filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length} results` : "0 results"}
              </span>
              <div className="pagination">
                <button className="secondary-button" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                  <ChevronLeft size={15} /> Previous
                </button>
                <button className="next-button" type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </footer>
          </div>
          <p className="inventory-footnote"><AlertTriangle size={14} /> Inventory changes are saved to your database.</p>
        </section> : (
          currentView === "Production" ? <ProductionPage
            products={products}
            orders={orders}
            loading={productionLoading}
            error={productionError}
            onCreate={createProductionOrder}
            onComplete={completeProductionOrder}
            onCancel={cancelProductionOrder}
          /> : currentView === "Order" ? <OrdersPage
            products={products}
            orders={salesOrders}
            loading={salesOrdersLoading}
            error={salesOrdersError}
            onCreate={createSalesOrder}
            onProcess={processSalesOrder}
            onFulfill={fulfillSalesOrder}
            onCancel={cancelSalesOrder}
          /> : currentView === "Report" ? <ReportsPage
            report={salesReport}
            loading={salesReportLoading}
            error={salesReportError}
            onLoad={loadSalesReport}
          /> : currentView === "Support" ? <SupportPage
            tickets={supportTickets}
            loading={supportLoading}
            error={supportError}
            onLoad={loadSupportTickets}
            onCreate={createSupportTicket}
            onUpdateStatus={updateSupportTicketStatus}
            onReply={replyToSupportTicket}
          /> : currentView === "Setting" ? <SettingsPage
            settings={appSettings}
            loading={settingsLoading}
            error={settingsError}
            onSave={saveAppSettings}
          /> : <UserAccessPage
            users={teamMembers}
            loading={teamMembersLoading}
            error={teamMembersError}
            currentUserId={authUser.id}
            onSave={saveTeamMember}
            onDelete={deleteTeamMember}
            onToggleStatus={toggleTeamMemberStatus}
          />
        )}
      </main>

      {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}

      {modal && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(""); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header">
              <div>
                <h2 id="modal-title">{modal === "add" ? "Add product" : "Record a sale"}</h2>
                <p>{modal === "add" ? "Add a new item to your inventory." : chosen?.name}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Close dialog" onClick={() => setModal("")}><X size={19} /></button>
            </div>
            {modal === "add" ? (
              <form className="modal-form" onSubmit={addProduct}>
                <label>Product name<input required maxLength="120" value={form.name} onChange={(event) => updateForm("name", event.target.value)} /></label>
                <div className="form-grid">
                  <label>SKU<input required maxLength="40" value={form.sku} onChange={(event) => updateForm("sku", event.target.value)} /></label>
                  <label>Category<select value={form.category} onChange={(event) => updateForm("category", event.target.value)}><option>Finished Good</option><option>Raw Material</option><option>Work in Progress</option></select></label>
                </div>
                <div className="form-grid">
                  <label>Incoming<input type="number" min="0" step="1" value={form.incoming} onChange={(event) => updateForm("incoming", event.target.value)} /></label>
                  <label>Stock on hand<input type="number" min="0" step="1" value={form.stock} onChange={(event) => updateForm("stock", event.target.value)} /></label>
                </div>
                <div className="form-grid">
                  <label>Unit price ($)<input required type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => updateForm("unitPrice", event.target.value)} /></label>
                  <label>Low-stock alert at<input type="number" min="0" step="1" value={form.lowStockThreshold} onChange={(event) => updateForm("lowStockThreshold", event.target.value)} /></label>
                </div>
                {actionError && <p className="form-error" role="alert">{actionError}</p>}
                <div className="modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setModal("")}>Cancel</button>
                  <button className="primary-button" type="submit"><Plus size={16} /> Add Product</button>
                </div>
              </form>
            ) : (
              <form className="modal-form" onSubmit={recordSale}>
                <div className="sale-stock"><span>Available stock</span><b>{chosen?.stock} units</b></div>
                <label>Quantity sold<input autoFocus required type="number" min="1" max={chosen?.stock} step="1" value={saleQuantity} onChange={(event) => setSaleQuantity(event.target.value)} /></label>
                <div className="sale-stock sale-total"><span>Sale total</span><b>${((chosen?.unitPrice || 0) * (Number(saleQuantity) || 0)).toFixed(2)}</b></div>
                {actionError && <p className="form-error" role="alert">{actionError}</p>}
                <div className="modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setModal("")}>Cancel</button>
                  <button className="primary-button" type="submit"><ShoppingCart size={16} /> Confirm sale</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
