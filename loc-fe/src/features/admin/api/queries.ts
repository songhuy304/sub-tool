import { queryOptions } from '@tanstack/react-query';
import {
  fetchAdminDashboard,
  fetchAdminOrderDetail,
  fetchAdminOrders,
  lookupAdminUser
} from './service';
import type { AdminOrdersFilters } from './types';

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  orders: () => [...adminKeys.all, 'orders'] as const,
  ordersList: (filters: AdminOrdersFilters) =>
    [...adminKeys.orders(), 'list', filters] as const,
  orderDetail: (orderId: string) =>
    [...adminKeys.orders(), 'detail', orderId] as const,
  lookup: (q: string) => [...adminKeys.all, 'lookup', q] as const
};

export function adminDashboardQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.dashboard(),
    queryFn: fetchAdminDashboard
  });
}

export function adminOrdersQueryOptions(filters: AdminOrdersFilters) {
  return queryOptions({
    queryKey: adminKeys.ordersList(filters),
    queryFn: () => fetchAdminOrders(filters)
  });
}

export function adminOrderDetailQueryOptions(orderId: string) {
  return queryOptions({
    queryKey: adminKeys.orderDetail(orderId),
    queryFn: () => fetchAdminOrderDetail(orderId),
    enabled: Boolean(orderId)
  });
}

export function adminLookupQueryOptions(q: string) {
  return queryOptions({
    queryKey: adminKeys.lookup(q),
    queryFn: () => lookupAdminUser(q),
    enabled: q.trim().length > 0
  });
}
