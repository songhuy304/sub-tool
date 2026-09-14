'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { getAdminErrorMessage } from '@/lib/axios-admin';
import { adminKeys } from '../api/queries';
import { reactivateOrder } from '../api/service';
import type { AdminOrderItem, AdminReactivateResponse } from '../api/types';
import { copyText } from '../lib/utils';

interface ReactivateDialogProps {
  order: AdminOrderItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: AdminReactivateResponse) => void;
}

export function ReactivateDialog({
  order,
  open,
  onOpenChange,
  onSuccess
}: ReactivateDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('warranty');
  const [autoDns, setAutoDns] = useState(true);
  const [result, setResult] = useState<AdminReactivateResponse | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      reactivateOrder(order!.order_id, {
        reason: reason.trim() || 'warranty',
        auto_dns: autoDns
      }),
    onSuccess: async (data) => {
      setResult(data);
      toast.success(data.message || 'Re-activate thành công');
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getAdminErrorMessage(error));
    }
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setResult(null);
      setReason('warranty');
      setAutoDns(true);
    }
    onOpenChange(next);
  }

  async function handleCopyDns() {
    if (!result?.dns_link) return;
    const ok = await copyText(result.dns_link);
    toast[ok ? 'success' : 'error'](
      ok ? 'Đã copy DNS link' : 'Không copy được'
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Re-activate bảo hành</DialogTitle>
          <DialogDescription>
            Inject lại Gold P1M (~30 ngày) và tạo DNS Anti-Revoke nếu bật
            auto_dns.
          </DialogDescription>
        </DialogHeader>

        {order && !result && (
          <div className='space-y-4'>
            <div className='rounded-md border border-border bg-muted/30 p-3 text-sm'>
              <p>
                <span className='text-muted-foreground'>Order:</span>{' '}
                <span className='font-medium'>{order.order_code}</span>
              </p>
              <p>
                <span className='text-muted-foreground'>User:</span>{' '}
                {order.username}
              </p>
              <p className='truncate'>
                <span className='text-muted-foreground'>UID:</span> {order.uid}
              </p>
              <p>
                <span className='text-muted-foreground'>Status:</span>{' '}
                {order.status}
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='reason'>Lý do</Label>
              <Input
                id='reason'
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder='warranty'
              />
            </div>

            <div className='flex items-center justify-between rounded-md border border-border px-3 py-2'>
              <div>
                <p className='text-sm font-medium'>Auto DNS</p>
                <p className='text-muted-foreground text-xs'>
                  Tạo lại profile NextDNS Anti-Revoke
                </p>
              </div>
              <Switch checked={autoDns} onCheckedChange={setAutoDns} />
            </div>
          </div>
        )}

        {result && (
          <div className='space-y-3 rounded-md border border-border p-3 text-sm'>
            <p className='font-medium text-emerald-600 dark:text-emerald-400'>
              {result.message || 'Thành công'}
            </p>
            {result.gold_status && (
              <p>
                Gold:{' '}
                {result.gold_status.active
                  ? `ON · ${result.gold_status.expires || '—'}`
                  : 'OFF'}
              </p>
            )}
            {result.dns_link && (
              <div className='space-y-2'>
                <p className='text-muted-foreground text-xs'>DNS link gửi khách</p>
                <div className='flex gap-2'>
                  <Input readOnly value={result.dns_link} className='font-mono text-xs' />
                  <Button type='button' variant='outline' size='icon' onClick={handleCopyDns}>
                    <Icons.copy className='size-4' />
                  </Button>
                </div>
              </div>
            )}
            {typeof result.reactivation_count === 'number' && (
              <p>Reactivation count: {result.reactivation_count}</p>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant='outline' onClick={() => handleOpenChange(false)}>
                Hủy
              </Button>
              <Button
                isLoading={mutation.isPending}
                onClick={() => mutation.mutate()}
                disabled={!order}
              >
                Xác nhận Re-activate
              </Button>
            </>
          ) : (
            <Button onClick={() => handleOpenChange(false)}>Đóng</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
