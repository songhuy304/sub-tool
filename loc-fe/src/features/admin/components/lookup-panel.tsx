'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getAdminErrorMessage } from '@/lib/axios-admin';
import { adminLookupQueryOptions } from '../api/queries';
import type { AdminOrderItem } from '../api/types';
import { canReactivate, formatDateTime, formatVnd } from '../lib/utils';
import { GoldStatusBadge, OrderStatusBadge } from './status-badges';
import { ReactivateDialog } from './reactivate-dialog';
import { OrderDetailSheet } from './order-detail-sheet';

export function LookupPanel() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderItem | null>(
    null
  );
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isFetching, isError, error, isFetched } = useQuery(
    adminLookupQueryOptions(query)
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(input.trim());
  }

  return (
    <div className='space-y-4'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-2 sm:flex-row'>
        <Input
          placeholder='username / @user / locket link / UID / LG######'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className='sm:max-w-md'
        />
        <Button type='submit' isLoading={isFetching} disabled={!input.trim()}>
          <Icons.search className='size-4' />
          Tra cứu
        </Button>
      </form>

      {isError && (
        <p className='text-destructive text-sm'>{getAdminErrorMessage(error)}</p>
      )}

      {isFetched && data && !data.success && (
        <p className='text-muted-foreground text-sm'>
          {data.error || 'Không tìm thấy user / đơn.'}
        </p>
      )}

      {data?.success && (
        <>
          <Card className='rounded-lg shadow-none'>
            <CardHeader>
              <CardTitle className='text-base'>Kết quả lookup</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-2 text-sm sm:grid-cols-2'>
              <p>
                <span className='text-muted-foreground'>Query:</span> {data.query}
              </p>
              <p>
                <span className='text-muted-foreground'>Username:</span>{' '}
                {data.username || '—'}
              </p>
              <p className='sm:col-span-2'>
                <span className='text-muted-foreground'>UID:</span>{' '}
                <span className='font-mono text-xs'>{data.uid || '—'}</span>
              </p>
              <div>
                <GoldStatusBadge
                  active={data.gold_status?.active}
                  expires={data.gold_status?.expires}
                />
              </div>
            </CardContent>
          </Card>

          <div className='rounded-md border border-border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.orders?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='text-muted-foreground h-20 text-center'
                    >
                      User không có đơn trong DB.
                    </TableCell>
                  </TableRow>
                )}
                {data.orders?.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell>
                      <div className='font-medium'>{order.order_code}</div>
                      <div className='text-muted-foreground font-mono text-xs'>
                        {order.order_id}
                      </div>
                    </TableCell>
                    <TableCell>{formatVnd(order.amount)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className='text-xs'>
                      {formatDateTime(order.created_at)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => {
                            setDetailOrderId(order.order_id);
                            setDetailOpen(true);
                          }}
                        >
                          Chi tiết
                        </Button>
                        {canReactivate(order.status) && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => {
                              setSelectedOrder(order);
                              setReactivateOpen(true);
                            }}
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
        </>
      )}

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
          setSelectedOrder(order);
          setReactivateOpen(true);
        }}
      />
    </div>
  );
}
