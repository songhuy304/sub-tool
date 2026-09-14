'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getAdminErrorMessage } from '@/lib/axios-admin';
import { adminOrdersQueryOptions } from '../api/queries';
import type { AdminOrderItem, OrderStatus } from '../api/types';
import {
  canReactivate,
  formatDateTime,
  formatVnd
} from '../lib/utils';
import { OrderStatusBadge } from './status-badges';
import { ReactivateDialog } from './reactivate-dialog';
import { OrderDetailSheet } from './order-detail-sheet';

const PAGE_SIZE = 50;

export function OrdersPanel({
  initialSearch = ''
}: {
  initialSearch?: string;
}) {
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [offset, setOffset] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderItem | null>(
    null
  );
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const filters = useMemo(
    () => ({
      search,
      status: status === 'ALL' ? '' : status,
      limit: PAGE_SIZE,
      offset
    }),
    [search, status, offset]
  );

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery(
    adminOrdersQueryOptions(filters)
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  }

  function openReactivate(order: AdminOrderItem) {
    setSelectedOrder(order);
    setReactivateOpen(true);
  }

  function openDetail(orderId: string) {
    setDetailOrderId(orderId);
    setDetailOpen(true);
  }

  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className='space-y-4'>
      <form
        onSubmit={handleSearch}
        className='flex flex-col gap-2 sm:flex-row sm:items-center'
      >
        <Input
          placeholder='Search username / uid / LG###### / order_id'
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className='sm:max-w-sm'
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as OrderStatus | 'ALL');
            setOffset(0);
          }}
        >
          <SelectTrigger className='w-full sm:w-40'>
            <SelectValue placeholder='Status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ALL'>Tất cả</SelectItem>
            <SelectItem value='PAID'>PAID</SelectItem>
            <SelectItem value='PENDING'>PENDING</SelectItem>
            <SelectItem value='FAILED'>FAILED</SelectItem>
          </SelectContent>
        </Select>
        <Button type='submit' variant='secondary'>
          <Icons.search className='size-4' />
          Tìm
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => refetch()}
          isLoading={isFetching && !isLoading}
        >
          Refresh
        </Button>
      </form>

      {isError && (
        <p className='text-destructive text-sm'>{getAdminErrorMessage(error)}</p>
      )}

      <div className='rounded-md border border-border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>BH</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className='h-4 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && (data?.orders?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7} className='text-muted-foreground h-24 text-center'>
                  Không có đơn.
                </TableCell>
              </TableRow>
            )}

            {data?.orders?.map((order) => (
              <TableRow key={order.order_id}>
                <TableCell>
                  <button
                    type='button'
                    className='text-left hover:underline'
                    onClick={() => openDetail(order.order_id)}
                  >
                    <div className='font-medium'>{order.order_code}</div>
                    <div className='text-muted-foreground font-mono text-xs'>
                      {order.order_id}
                    </div>
                  </button>
                </TableCell>
                <TableCell>
                  <div>{order.username}</div>
                  <div className='text-muted-foreground max-w-[140px] truncate font-mono text-xs'>
                    {order.uid}
                  </div>
                </TableCell>
                <TableCell>{formatVnd(order.amount)}</TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell>{order.reactivation_count ?? 0}</TableCell>
                <TableCell className='text-muted-foreground text-xs'>
                  {formatDateTime(order.created_at)}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-1'>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => openDetail(order.order_id)}
                    >
                      Chi tiết
                    </Button>
                    {canReactivate(order.status) && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => openReactivate(order)}
                      >
                        Re-activate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between text-sm'>
        <p className='text-muted-foreground'>
          {total} đơn · trang {page}/{totalPages}
        </p>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={offset <= 0}
            onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
          >
            Trước
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((v) => v + PAGE_SIZE)}
          >
            Sau
          </Button>
        </div>
      </div>

      <ReactivateDialog
        order={selectedOrder}
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
      />

      <OrderDetailSheet
        orderId={detailOrderId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onReactivate={(order) => {
          setDetailOpen(false);
          openReactivate(order);
        }}
      />
    </div>
  );
}
