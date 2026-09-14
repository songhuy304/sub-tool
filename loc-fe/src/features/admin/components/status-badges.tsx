import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '../api/types';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === 'PAID') {
    return <Badge variant='success'>PAID</Badge>;
  }
  if (status === 'PENDING') {
    return <Badge variant='secondary'>PENDING</Badge>;
  }
  if (status === 'FAILED') {
    return <Badge variant='destructive'>FAILED</Badge>;
  }
  return <Badge variant='outline'>{status}</Badge>;
}

export function GoldStatusBadge({
  active,
  expires
}: {
  active?: boolean;
  expires?: string | null;
}) {
  if (active) {
    return (
      <Badge variant='success'>
        Gold ON{expires ? ` · ${expires}` : ''}
      </Badge>
    );
  }
  return <Badge variant='outline'>Gold OFF</Badge>;
}
