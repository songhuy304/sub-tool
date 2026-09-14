import { adminAxios } from '@/lib/axios-admin';
import type {
  AdminActivateParams,
  AdminDashboardResponse,
  AdminOrderDetailResponse,
  AdminOrdersFilters,
  AdminOrdersResponse,
  AdminReactivateResponse,
  AdminUserLookupResponse,
  ReactivateOrderPayload
} from './types';

export async function fetchAdminDashboard(): Promise<AdminDashboardResponse> {
  const { data } = await adminAxios.get<AdminDashboardResponse>(
    '/api/admin/dashboard'
  );
  return data;
}

export async function fetchAdminOrders(
  filters: AdminOrdersFilters = {}
): Promise<AdminOrdersResponse> {
  const params: Record<string, string | number> = {
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0
  };
  if (filters.status) params.status = filters.status;
  if (filters.search?.trim()) params.search = filters.search.trim();

  const { data } = await adminAxios.get<AdminOrdersResponse>(
    '/api/admin/orders',
    { params }
  );
  return data;
}

export async function fetchAdminOrderDetail(
  orderId: string
): Promise<AdminOrderDetailResponse> {
  const { data } = await adminAxios.get<AdminOrderDetailResponse>(
    `/api/admin/orders/${orderId}`
  );
  return data;
}

export async function lookupAdminUser(
  q: string
): Promise<AdminUserLookupResponse> {
  const { data } = await adminAxios.get<AdminUserLookupResponse>(
    '/api/admin/users/lookup',
    { params: { q: q.trim() } }
  );
  return data;
}

export async function reactivateOrder(
  orderId: string,
  payload: ReactivateOrderPayload = {}
): Promise<AdminReactivateResponse> {
  const { data } = await adminAxios.post<AdminReactivateResponse>(
    `/api/admin/orders/${orderId}/reactivate`,
    {
      reason: payload.reason ?? 'warranty',
      auto_dns: payload.auto_dns ?? true,
      token_index: payload.token_index ?? null
    }
  );
  return data;
}

export async function activateManual(
  params: AdminActivateParams
): Promise<AdminReactivateResponse> {
  const query: Record<string, string | number | boolean> = {
    reason: params.reason ?? 'manual',
    auto_dns: params.auto_dns ?? true
  };
  if (params.username?.trim()) query.username = params.username.trim();
  if (params.uid?.trim()) query.uid = params.uid.trim();
  if (params.token_index != null) query.token_index = params.token_index;

  const { data } = await adminAxios.post<AdminReactivateResponse>(
    '/api/admin/activate',
    null,
    { params: query }
  );
  return data;
}
