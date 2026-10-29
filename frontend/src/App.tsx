import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  getProducts,
  createProduct,
  adjustProductStock,
  createOrder,
  getOrderById,
  cancelOrder,
  type SalesOrder,
  type Product,
} from "./services/api";

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [customer, setCustomer] = useState("");
  const [orderSku, setOrderSku] = useState("");
  const [orderQty, setOrderQty] = useState("1");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [orderIdInput, setOrderIdInput] = useState("");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<"in" | "out">("in");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  async function loadProducts() {
    try {
      setError(null);
      const response = await getProducts();
      setProducts(response.data);
    } catch {
      setError("Gagal mengambil data produk.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setOrderError(null);
    setSuccessMessage(null);

    const qty = Number(orderQty);

    if (!customer.trim()) {
      setOrderError("Nama pelanggan wajib diisi.");
      return;
    }

    if (!orderSku) {
      setOrderError("Silakan pilih produk.");
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setOrderError("Jumlah harus berupa bilangan bulat lebih dari 0.");
      return;
    }

    try {
      setOrderSaving(true);

      const order = await createOrder({
        customer: customer.trim(),
        items: [
          {
            sku: orderSku,
            qty,
          },
        ],
      });
      setSelectedOrder(order as SalesOrder);
      setOrderIdInput(String(order.id));
      setDetailError(null);

      await loadProducts();

      setCustomer("");
      setOrderSku("");
      setOrderQty("1");

      setSuccessMessage(
        `Pesanan #${order.id} berhasil dibuat. Total: ${formatPrice(Number(order.total))}`,
      );
    } catch (err) {
      setOrderError(
        err instanceof Error ? err.message : "Gagal membuat pesanan.",
      );
    } finally {
      setOrderSaving(false);
    }
  }

  async function handleFindOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDetailError(null);
    setSelectedOrder(null);

    const id = Number(orderIdInput);

    if (!Number.isInteger(id) || id <= 0) {
      setDetailError("ID pesanan harus berupa bilangan bulat positif.");
      return;
    }

    try {
      setDetailLoading(true);
      const order = await getOrderById(id);
      setSelectedOrder(order);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Gagal mengambil detail pesanan.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCancelOrder() {
    if (!selectedOrder) return;

    if (selectedOrder.status !== "CREATED") {
      setDetailError("Hanya pesanan berstatus CREATED yang dapat dibatalkan.");
      return;
    }

    const confirmed = window.confirm(
      `Batalkan pesanan #${selectedOrder.id}? Stok barang akan dikembalikan.`,
    );

    if (!confirmed) return;

    try {
      setCancelSaving(true);
      setDetailError(null);

      const updatedOrder = await cancelOrder(selectedOrder.id);
      setSelectedOrder(updatedOrder);

      await loadProducts();
      setSuccessMessage(
        `Pesanan #${updatedOrder.id} berhasil dibatalkan. Stok telah dikembalikan.`,
      );
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Gagal membatalkan pesanan.",
      );
    } finally {
      setCancelSaving(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const keyword = search.toLowerCase();

    const matchesSearch =
      product.name.toLowerCase().includes(keyword) ||
      product.sku.toLowerCase().includes(keyword);

    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "low" && product.stock > 0 && product.stock < 10) ||
      (stockFilter === "out" && product.stock === 0);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && product.isActive) ||
      (statusFilter === "inactive" && !product.isActive);

    return matchesSearch && matchesStock && matchesStatus;
  });

  const activeProducts = products.filter((product) => product.isActive).length;

  const totalStockValue = products.reduce(
    (total, product) => total + product.price * product.stock,
    0,
  );

  const lowStockProducts = products.filter(
    (product) => product.stock > 0 && product.stock < 10,
  ).length;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(price);

  async function handleAddProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (!sku.trim() || !name.trim()) {
      setFormError("SKU dan nama produk wajib diisi.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setFormError("Harga harus lebih besar dari 0.");
      return;
    }

    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      setFormError("Stok harus berupa bilangan bulat minimal 0.");
      return;
    }

    try {
      setSaving(true);

      await createProduct({
        sku: sku.trim(),
        name: name.trim(),
        price: parsedPrice,
        stock: parsedStock,
      });

      await loadProducts();

      setSearch("");
      setStockFilter("all");
      setStatusFilter("all");
      setSku("");
      setName("");
      setPrice("");
      setStock("");
      setShowAddForm(false);
      setSuccessMessage("Produk berhasil ditambahkan!");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menambahkan produk.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openAdjustForm(product: Product) {
    setSelectedProduct(product);
    setAdjustType("in");
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustError(null);
    setSuccessMessage(null);
  }

  async function handleAdjustStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdjustError(null);
    setSuccessMessage(null);

    if (!selectedProduct) return;

    const qty = Number(adjustQuantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      setAdjustError("Jumlah harus berupa bilangan bulat lebih dari 0.");
      return;
    }

    try {
      setAdjustSaving(true);

      await adjustProductStock(selectedProduct.id, {
        type: adjustType,
        qty,
        note: adjustReason.trim(),
      });

      const response = await getProducts();
      setProducts(response.data);

      setSelectedProduct(null);
      setAdjustQuantity("");
      setAdjustReason("");
      setAdjustType("in");
      setSuccessMessage("Stok produk berhasil diperbarui!");
    } catch (err) {
      setAdjustError(
        err instanceof Error ? err.message : "Gagal memperbarui stok produk.",
      );
    } finally {
      setAdjustSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-800 sm:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">StockFlow</h1>
        <p className="mt-2 text-slate-500">Inventory Management System</p>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Products</p>
          <p className="mt-2 text-2xl font-bold">{products.length}</p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active Products</p>
          <p className="mt-2 text-2xl font-bold">{activeProducts}</p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Stock Value</p>
          <p className="mt-2 text-2xl font-bold">
            {formatPrice(totalStockValue)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Low Stock</p>
          <p className="mt-2 text-2xl font-bold">{lowStockProducts}</p>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Create Order</h2>
          <p className="mt-1 text-sm text-slate-500">
            Buat pesanan baru dan perbarui stok secara otomatis.
          </p>
        </div>

        {orderError && (
          <div role="alert" className="alert alert-error mb-4">
            <span>{orderError}</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setOrderError(null)}
            >
              Tutup
            </button>
          </div>
        )}

        <form
          onSubmit={handleCreateOrder}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <label className="form-control sm:col-span-2">
            <span className="label-text mb-2">Customer Name</span>
            <input
              type="text"
              className="input input-bordered w-full bg-white"
              placeholder="Masukkan nama pelanggan"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-2">Product</span>
            <select
              className="select select-bordered w-full bg-white"
              value={orderSku}
              onChange={(event) => setOrderSku(event.target.value)}
              required
            >
              <option value="">Pilih produk</option>
              {products
                .filter((product) => product.isActive && product.stock > 0)
                .map((product) => (
                  <option key={product.id} value={product.sku}>
                    {product.sku} — {product.name} (Stok: {product.stock})
                  </option>
                ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text mb-2">Quantity</span>
            <input
              type="number"
              className="input input-bordered w-full bg-white"
              min="1"
              step="1"
              value={orderQty}
              onChange={(event) => setOrderQty(event.target.value)}
              required
            />
          </label>

          {orderSku && (
            <div className="rounded-lg bg-slate-50 p-4 sm:col-span-2">
              <p className="text-sm text-slate-500">Harga satuan</p>
              <p className="font-semibold">
                {formatPrice(
                  products.find((product) => product.sku === orderSku)?.price ??
                    0,
                )}
              </p>
              <p className="mt-2 text-sm text-slate-500">Estimasi total</p>
              <p className="text-xl font-bold">
                {formatPrice(
                  (products.find((product) => product.sku === orderSku)
                    ?.price ?? 0) *
                    (Number(orderQty) > 0 ? Number(orderQty) : 0),
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Total final dihitung oleh backend.
              </p>
            </div>
          )}

          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={orderSaving || loading}
            >
              {orderSaving ? "Menyimpan..." : "Buat Pesanan"}
            </button>
          </div>
        </form>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-2 text-xl font-semibold">Order Detail</h2>
        <p className="mb-4 text-sm text-slate-500">
          Masukkan ID pesanan untuk melihat detail atau membatalkan pesanan.
        </p>

        <form
          onSubmit={handleFindOrder}
          className="mb-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="number"
            min="1"
            step="1"
            className="input input-bordered w-full bg-white"
            placeholder="Contoh: 1"
            value={orderIdInput}
            onChange={(event) => setOrderIdInput(event.target.value)}
            required
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={detailLoading}
          >
            {detailLoading ? "Memuat..." : "Cari Pesanan"}
          </button>
        </form>

        {detailError && (
          <div role="alert" className="alert alert-error mb-4">
            <span>{detailError}</span>
          </div>
        )}

        {selectedOrder && (
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">
                  Pesanan #{selectedOrder.id}
                </h3>
                <p className="text-sm text-slate-500">
                  Pelanggan: {selectedOrder.customer}
                </p>
              </div>

              <span
                className={`badge ${
                  selectedOrder.status === "CREATED"
                    ? "badge-success"
                    : "badge-ghost"
                }`}
              >
                {selectedOrder.status}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Jumlah</th>
                    <th className="p-3">Harga Satuan</th>
                    <th className="p-3">Subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedOrder.item.map((item, index) => (
                    <tr
                      key={`${item.sku}-${index}`}
                      className="border-b last:border-0"
                    >
                      <td className="p-3 font-medium">{item.sku}</td>
                      <td className="p-3">{item.qty}</td>
                      <td className="p-3">
                        {formatPrice(Number(item.unitPrice))}
                      </td>
                      <td className="p-3">
                        {formatPrice(Number(item.unitPrice) * item.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Total Pesanan</p>
                <p className="text-xl font-bold">
                  {formatPrice(Number(selectedOrder.total))}
                </p>
              </div>

              {selectedOrder.status === "CREATED" && (
                <button
                  type="button"
                  className="btn btn-error"
                  disabled={cancelSaving}
                  onClick={() => void handleCancelOrder()}
                >
                  {cancelSaving ? "Membatalkan..." : "Batalkan Pesanan"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {successMessage && (
        <div role="status" className="alert alert-success mb-4">
          <span>{successMessage}</span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setSuccessMessage(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {loading && <p className="mb-4 text-slate-500">Memuat produk...</p>}

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadProducts()}
          >
            Coba lagi
          </button>
        </div>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Products</h2>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFormError(null);
                setSuccessMessage(null);
                setShowAddForm(true);
              }}
            >
              + Add Product
            </button>
          </div>

          <input
            type="text"
            placeholder="Search SKU or product name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
          />

          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "Semua Stok" },
              { value: "low", label: "Stok Rendah" },
              { value: "out", label: "Stok Habis" },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStockFilter(filter.value)}
                className={`btn btn-sm ${
                  stockFilter === filter.value ? "btn-primary" : ""
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "Semua Status" },
              { value: "active", label: "Aktif" },
              { value: "inactive", label: "Nonaktif" },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`btn btn-sm ${
                  statusFilter === filter.value ? "btn-primary" : ""
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {showAddForm && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-4 text-lg font-semibold">Add New Product</h3>

            {formError && (
              <div role="alert" className="alert alert-error mb-4">
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={handleAddProduct}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <label className="form-control">
                <span className="label-text mb-2">SKU</span>
                <input
                  className="input input-bordered w-full bg-white"
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                  placeholder="SKU-002"
                  required
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Product Name</span>
                <input
                  className="input input-bordered w-full bg-white"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Wireless Mouse"
                  required
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Price (IDR)</span>
                <input
                  className="input input-bordered w-full bg-white"
                  type="number"
                  min="1"
                  step="1"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="150000"
                  required
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Initial Stock</span>
                <input
                  className="input input-bordered w-full bg-white"
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  placeholder="15"
                  required
                />
              </label>

              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={saving}
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        )}

        {selectedProduct && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="mb-1 text-lg font-semibold">Adjust Stock</h3>

            <p className="mb-4 text-sm text-slate-600">
              {selectedProduct.name} ({selectedProduct.sku})
              {" — Stok saat ini: "}
              <strong>{selectedProduct.stock}</strong>
            </p>

            {adjustError && (
              <div role="alert" className="alert alert-error mb-4">
                <span>{adjustError}</span>
              </div>
            )}

            <form
              onSubmit={handleAdjustStock}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <label className="form-control">
                <span className="label-text mb-2">Movement Type</span>
                <select
                  className="select select-bordered w-full bg-white"
                  value={adjustType}
                  onChange={(event) =>
                    setAdjustType(event.target.value as "in" | "out")
                  }
                >
                  <option value="in">Stock In (+)</option>
                  <option value="out">Stock Out (-)</option>
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Quantity</span>
                <input
                  className="input input-bordered w-full bg-white"
                  type="number"
                  min="1"
                  step="1"
                  value={adjustQuantity}
                  onChange={(event) => setAdjustQuantity(event.target.value)}
                  placeholder="Contoh: 5"
                  required
                />
              </label>

              <label className="form-control sm:col-span-2">
                <span className="label-text mb-2">Note (optional)</span>
                <input
                  className="input input-bordered w-full bg-white"
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  placeholder="Contoh: Restock dari supplier"
                />
              </label>

              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={adjustSaving}
                  onClick={() => {
                    setSelectedProduct(null);
                    setAdjustError(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={adjustSaving}
                >
                  {adjustSaving ? "Saving..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Price</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Stock Status</th>
                <th className="p-3">Product Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                !error &&
                filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{product.sku}</td>
                    <td className="p-3">{product.name}</td>
                    <td className="p-3">{formatPrice(product.price)}</td>
                    <td className="p-3">{product.stock}</td>

                    <td className="p-3">
                      {product.stock === 0 ? (
                        <span className="badge badge-error">Out of Stock</span>
                      ) : product.stock < 10 ? (
                        <span className="badge badge-warning">Low Stock</span>
                      ) : (
                        <span className="badge badge-success">In Stock</span>
                      )}
                    </td>

                    <td className="p-3">
                      {product.isActive ? (
                        <span className="badge badge-success">Aktif</span>
                      ) : (
                        <span className="badge badge-ghost">Nonaktif</span>
                      )}
                    </td>

                    <td className="p-3">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline btn-primary"
                        onClick={() => openAdjustForm(product)}
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                ))}

              {!loading && !error && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default App;
