export type Product = {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
  last_movement_at: string | null;
};
export type AdjustStockInput = {
  type: "in" | "out";
  qty: number;
  note: string;
};
export type CreateOrderItem = {
  sku: string;
  qty: number;
};
export type CreateOrderInput = {
  customer: string;
  items: CreateOrderItem[];
};
export type CreateProductInput = {
  sku: string;
  name: string;
  price: number;
  stock: number;
};
type ProductsResponse = {
  success: boolean;
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type OrderItem = {
  id?: number;
  orderId?: number;
  sku: string;
  qty: number;
  unitPrice: number | string;
};

export type SalesOrder = {
  id: number;
  customer: string;
  total: number | string;
  status: "CREATED" | "CANCELLED";
  createdAt?: string;
  cancelledAt?: string | null;
  item: OrderItem[];
};

const API_BASE_URL = "/api";

export async function getProducts(): Promise<ProductsResponse> {
  const response = await fetch(`${API_BASE_URL}/products`);

  if (!response.ok) {
    throw new Error(`Gagal mengambil produk: ${response.status}`);
  }

  return (await response.json()) as ProductsResponse;
}
export async function createProduct(input: CreateProductInput) {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Gagal menambahkan produk.");
  }

  return result;
}
export async function adjustProductStock(
  productId: number,
  input: AdjustStockInput,
) {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/stock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await response.json();

  if (!response.ok) {
    const message =
      result?.error?.message ??
      result?.message ??
      "Gagal memperbarui stok produk.";

    throw new Error(message);
  }

  return result;
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<SalesOrder> {
  const response = await fetch(`${API_BASE_URL}/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await response.json();

  if (!response.ok) {
    const message =
      result?.error?.message ??
      (result?.error?.code === "INSUFFICIENT_STOCK"
        ? `Stok SKU ${result.error.sku} tidak cukup. Stok tersedia: ${result.error.available}.`
        : "Gagal membuat pesanan.");

    throw new Error(message);
  }

  return result.data as SalesOrder;
}

export async function getOrderById(id: number): Promise<SalesOrder> {
  const response = await fetch(`${API_BASE_URL}/order/${id}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message ?? "Gagal mengambil detail pesanan.",
    );
  }

  return result.data;
}

export async function cancelOrder(id: number): Promise<SalesOrder> {
  const response = await fetch(`${API_BASE_URL}/order/${id}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message ??
        (result?.error?.code === "ORDER_ALREADY_CANCELLED"
          ? "Pesanan sudah dibatalkan."
          : "Gagal membatalkan pesanan."),
    );
  }

  return result.data;
}
