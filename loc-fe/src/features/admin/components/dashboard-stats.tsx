'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getAdminErrorMessage } from '@/lib/axios-admin';
import { adminDashboardQueryOptions } from '../api/queries';
import { formatVnd } from '../lib/utils';

export function DashboardStats() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    adminDashboardQueryOptions()
  );

  if (isLoading) {
    return (
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className='h-24 w-full rounded-lg' />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className='space-y-3 rounded-md border border-border p-4'>
        <p className='text-destructive text-sm'>{getAdminErrorMessage(error)}</p>
        <Button variant='outline' size='sm' onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  const cards = [
    { label: 'Tổng đơn', value: data?.total_orders ?? 0 },
    { label: 'PAID', value: data?.paid ?? 0 },
    { label: 'PENDING', value: data?.pending ?? 0 },
    { label: 'FAILED', value: data?.failed ?? 0 },
    { label: 'Doanh thu', value: formatVnd(data?.revenue ?? 0) },
    { label: 'Bảo hành', value: data?.reactivations ?? 0 },
    { label: 'Unique users', value: data?.unique_users ?? 0 },
    {
      label: 'API requests',
      value: `${data?.success_requests ?? 0}/${data?.total_requests ?? 0}`
    }
  ];

  return (
    <div className='space-y-3'>
      <div className='flex justify-end'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => refetch()}
          isLoading={isFetching}
        >
          Refresh
        </Button>
      </div>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {cards.map((card) => (
          <Card key={card.label} className='rounded-lg shadow-none'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-2xl font-semibold tabular-nums'>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
