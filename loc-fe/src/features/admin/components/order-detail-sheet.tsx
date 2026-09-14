'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { getAdminErrorMessage } from '@/lib/axios-admin';
import { adminOrderDetailQueryOptions } from '../api/queries';
import type { AdminOrderItem } from '../api/types';
import { canReactivate, formatDateTime, formatVnd } from '../lib/utils';
import { GoldStatusBadge, OrderStatusBadge } from './status-badges';

interface OrderDetailSheetProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReactivate?: (order: AdminOrderItem) => void;
}

export function OrderDetailSheet({
  orderId,
  open,
  onOpenChange,
  onReactivate
}: OrderDetailSheetProps) {
  const { data, isLoading, isError, error } = useQuery({
    ...adminOrderDetailQueryOptions(orderId || ''),
    enabled: open && Boolean(orderId)
  });

  const order = data?.order;
  const suggestWarranty =
    order?.status === 'PAID' && data?.gold_status?.active === false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>Chi tiết đơn</SheetTitle>
          <SheetDescription>
            {order?.order_code || orderId || '—'}
          </SheetDescription>
        </SheetHeader>

        <div className='mt-4 space-y-4 px-1'>
          {isLoading && (
            <div className='space-y-2'>
              <Skeleton className='h-4 w-2/3' />
              <Skeleton className='h-4 w-1/2' />
              <Skeleton className='h-24 w-full' />
            </div>
          )}

          {isError && (
            <p className='text-destructive text-sm'>
              {getAdminErrorMessage(error)}
            </p>
          )}

          {order && (
            <>
              {suggestWarranty && (
                <div className='rounded-md border border-border bg-muted/40 p-3 text-sm'>
                  Đơn đã PAID nhưng Gold đang OFF — nên chạy bảo hành.
                </div>
              )}

              <div className='grid gap-2 text-sm'>
                <Row label='Status' value={<OrderStatusBadge status={order.status} />} />
                <Row label='Username' value={order.username} />
                <Row label='UID' value={<span className='break-all font-mono text-xs'>{order.uid}</span>} />
                <Row label='Amount' value={formatVnd(order.amount)} />
                <Row label='Created' value={formatDateTime(order.created_at)} />
                <Row label='Paid' value={formatDateTime(order.paid_at)} />
                <Row label='Token' value={order.token_used || '—'} />
                <Row
                  label='BH count'
                  value={String(order.reactivation_count ?? 0)}
                />
                <Row
                  label='Gold'
                  value={
                    <GoldStatusBadge
                      active={data?.gold_status?.active}
                      expires={data?.gold_status?.expires}
                    />
                  }
                />
                <Row
                  label='DNS'
                  value={
                    order.dns_link ? (
                      <a
                        href={order.dns_link}
                        target='_blank'
                        rel='noreferrer'
                        className='text-foreground underline underline-offset-2'
                      >
                        Mở link
                      </a>
                    ) : (
                      '—'
                    )
                  }
                />
              </div>

              {canReactivate(order.status) && (
                <Button
                  className='w-full'
                  onClick={() => onReactivate?.(order)}
                >
                  <Icons.shield className='size-4' />
                  Re-activate
                </Button>
              )}

              <div>
                <h3 className='mb-2 text-sm font-medium'>Lịch sử bảo hành</h3>
                {(data?.reactivations?.length ?? 0) === 0 ? (
                  <p className='text-muted-foreground text-sm'>Chưa có.</p>
                ) : (
                  <ul className='space-y-2'>
                    {data!.reactivations.map((item) => (
                      <li
                        key={item.id}
                        className='rounded-md border border-border p-3 text-xs'
                      >
                        <p className='font-medium'>
                          {item.status} · {item.reason}
                        </p>
                        <p className='text-muted-foreground'>
                          {formatDateTime(item.created_at)}
                        </p>
                        {item.dns_link && (
                          <a
                            href={item.dns_link}
                            target='_blank'
                            rel='noreferrer'
                            className='mt-1 inline-block underline'
                          >
                            DNS link
                          </a>
                        )}
                        {item.message && (
                          <p className='mt-1 break-words'>{item.message}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className='flex items-start justify-between gap-4 border-b border-border py-2 last:border-0'>
      <span className='text-muted-foreground shrink-0'>{label}</span>
      <div className='text-right'>{value}</div>
    </div>
  );
}
