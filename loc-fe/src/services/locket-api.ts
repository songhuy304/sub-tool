import { API_URL } from "@/config/app.config";

export interface ResolveResponse {
  success: boolean;
  username?: string;
  uid?: string;
  status?: {
    active: boolean;
    expires: string | null;
  };
  error?: string | null;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id: string;
  order_code: string;
  username: string;
  uid: string;
  amount: number;
  qr_url: string;
  account_number: string;
  bank: string;
  payment_content: string;
  instructions?: string;
  error?: string | null;
}

export interface OrderStatusResponse {
  success: boolean;
  order_id: string;
  order_code: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | string;
  amount?: number;
  username?: string;
  uid?: string;
  dns_profile_id?: string;
  dns_link?: string;
  paid_at?: string;
  error?: string | null;
}

/**
 * Clean username from various formats:
 * - "@thanhdo" -> "thanhdo"
 * - "https://locket.cam/thanhdo" -> "thanhdo"
 * - "  thanhdo  " -> "thanhdo"
 */
export function sanitizeUsername(input: string): string {
  let cleaned = input.trim();
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    try {
      const url = new URL(cleaned);
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        cleaned = segments[segments.length - 1];
      }
    } catch {
      // fallback if not a valid URL structure
      cleaned = cleaned.replace(/^https?:\/\/[^/]+\/?/, "");
    }
  }
  return cleaned.replace(/^@+/, "").trim();
}

/**
 * Step 1: Kiểm tra & Phân giải Username
 */
export async function resolveLocketUsername(
  username: string,
): Promise<ResolveResponse> {
  const cleanUser = sanitizeUsername(username);
  if (!cleanUser) {
    return {
      success: false,
      error: "Vui lòng nhập Username Locket hợp lệ.",
    };
  }

  try {
    const res = await fetch(`${API_URL}/api/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: cleanUser }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        success: false,
        error:
          errData?.detail ||
          errData?.error ||
          `Lỗi máy chủ (${res.status}): Không thể tìm kiếm username.`,
      };
    }

    const data: ResolveResponse = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error:
        err.message?.includes("Failed to fetch") || err.name === "TypeError"
          ? "Không thể kết nối đến máy chủ API. Vui lòng kiểm tra backend server đang chạy."
          : `Lỗi kết nối: ${err.message}`,
    };
  }
}

/**
 * Step 2: Tạo Đơn Hàng & Lấy Thông Tin Thanh Toán
 */
export async function createPaymentOrder(
  username: string,
  amount: number,
): Promise<CreateOrderResponse> {
  const cleanUser = sanitizeUsername(username);

  try {
    const res = await fetch(`${API_URL}/api/payment/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: cleanUser,
        amount,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(
        errData?.detail ||
          errData?.error ||
          `Lỗi tạo đơn (${res.status}): Không thể khởi tạo đơn hàng.`,
      );
    }

    const data: CreateOrderResponse = await res.json();
    return data;
  } catch (err: any) {
    throw new Error(err.message || "Lỗi tạo đơn hàng thanh toán.");
  }
}

/**
 * Step 3: Polling Kiểm Tra Trạng Thái Thanh Toán
 */
export async function checkPaymentStatus(
  orderId: string,
): Promise<OrderStatusResponse> {
  try {
    const res = await fetch(`${API_URL}/api/payment/order/${orderId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(
        errData?.detail ||
          errData?.error ||
          `Lỗi kiểm tra đơn (${res.status})`,
      );
    }

    const data: OrderStatusResponse = await res.json();
    return data;
  } catch (err: any) {
    throw new Error(err.message || "Không thể kiểm tra trạng thái đơn hàng.");
  }
}
