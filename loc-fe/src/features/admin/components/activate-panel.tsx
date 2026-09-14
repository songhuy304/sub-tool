'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminErrorMessage } from '@/lib/axios-admin';
import { adminKeys } from '../api/queries';
import { activateManual } from '../api/service';
import type { AdminReactivateResponse } from '../api/types';
import { copyText } from '../lib/utils';

export function ActivatePanel() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [uid, setUid] = useState('');
  const [reason, setReason] = useState('manual');
  const [autoDns, setAutoDns] = useState(true);
  const [result, setResult] = useState<AdminReactivateResponse | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      activateManual({
        username: username.trim() || undefined,
        uid: uid.trim() || undefined,
        reason: reason.trim() || 'manual',
        auto_dns: autoDns
      }),
    onSuccess: async (data) => {
      setResult(data);
      toast.success(data.message || 'Activate thành công');
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
    onError: (error) => {
      toast.error(getAdminErrorMessage(error));
    }
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() && !uid.trim()) {
      toast.error('Nhập username hoặc UID.');
      return;
    }
    setResult(null);
    mutation.mutate();
  }

  async function handleCopyDns() {
    if (!result?.dns_link) return;
    const ok = await copyText(result.dns_link);
    toast[ok ? 'success' : 'error'](ok ? 'Đã copy DNS link' : 'Không copy được');
  }

  return (
    <div className='max-w-lg space-y-4'>
      <Card className='rounded-lg shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>Activate thủ công</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='username'>Username</Label>
              <Input
                id='username'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder='thanhdo / @thanhdo / link'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='uid'>UID (28 ký tự)</Label>
              <Input
                id='uid'
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder='AbCdEf...'
                className='font-mono'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='reason'>Reason</Label>
              <Input
                id='reason'
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder='manual'
              />
            </div>
            <div className='flex items-center justify-between rounded-md border border-border px-3 py-2'>
              <div>
                <p className='text-sm font-medium'>Auto DNS</p>
                <p className='text-muted-foreground text-xs'>
                  Tạo profile NextDNS Anti-Revoke
                </p>
              </div>
              <Switch checked={autoDns} onCheckedChange={setAutoDns} />
            </div>
            <Button type='submit' isLoading={mutation.isPending} className='w-full'>
              <Icons.shield className='size-4' />
              Activate
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className='rounded-lg shadow-none'>
          <CardHeader>
            <CardTitle className='text-base'>Kết quả</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <p>{result.message || 'OK'}</p>
            {result.username && <p>User: {result.username}</p>}
            {result.gold_status && (
              <p>
                Gold:{' '}
                {result.gold_status.active
                  ? `ON · ${result.gold_status.expires || '—'}`
                  : 'OFF'}
              </p>
            )}
            {result.dns_link && (
              <div className='flex gap-2'>
                <Input readOnly value={result.dns_link} className='font-mono text-xs' />
                <Button type='button' variant='outline' size='icon' onClick={handleCopyDns}>
                  <Icons.copy className='size-4' />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
