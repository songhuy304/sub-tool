export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | string;

export interface GoldStatus {
  active: boolean;
  expires: string | null;
}

export interface AdminOrderItem {
  order_id: string;
  order_code: string;
  username: string;
  uid: string;
  amount: number;
  status: OrderStatus;
  dns_profile_id?: string | null;
  dns_link?: string | null;
  token_used?: string | null;
  transaction_id?: number | null;
  created_at?: string | null;
  paid_at?: string | null;
  reactivation_count?: number;
}

export interface AdminDashboardResponse {
  success: boolean;
  total_orders: number;
  paid: number;
  pending: number;
  failed: number;
  revenue: number;
  reactivations: number;
  total_requests: number;
  success_requests: number;
  fail_requests: number;
  unique_users: number;
}

export interface AdminOrdersFilters {
  status?: OrderStatus | '';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminOrdersResponse {
  success: boolean;
  total: number;
  limit: number;
  offset: number;
  orders: AdminOrderItem[];
}

export interface ReactivationLog {
  id: number;
  order_id: string;
  username: string;
  uid: string;
  reason: string;
  status: string;
  token_used?: string | null;
  dns_link?: string | null;
  message?: string | null;
  created_at?: string | null;
}

export interface AdminOrderDetailResponse {
  success: boolean;
  order: AdminOrderItem;
  gold_status: GoldStatus;
  reactivations: ReactivationLog[];
  error?: string | null;
}

export interface AdminUserLookupResponse {
  success: boolean;
  query: string;
  username?: string;
  uid?: string;
  gold_status?: GoldStatus;
  orders?: AdminOrderItem[];
  error?: string | null;
}

export interface ReactivateOrderPayload {
  reason?: string;
  auto_dns?: boolean;
  token_index?: number | null;
}

export interface AdminActivateParams {
  username?: string;
  uid?: string;
  reason?: string;
  auto_dns?: boolean;
  token_index?: number | null;
}

export interface AdminReactivateResponse {
  success: boolean;
  message?: string;
  order_id?: string;
  username?: string;
  uid?: string;
  token_used?: string;
  dns_profile_id?: string;
  dns_link?: string;
  gold_status?: GoldStatus;
  reactivation_count?: number;
  logs?: string[];
  error?: string | null;
}
