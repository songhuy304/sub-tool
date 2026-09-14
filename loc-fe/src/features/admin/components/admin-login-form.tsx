'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setAdminApiKey } from '@/lib/admin-auth';
import { adminAxios, getAdminErrorMessage } from '@/lib/axios-admin';

export function AdminLoginForm() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) {
      toast.error('Nhập Admin API Key.');
      return;
    }

    setLoading(true);
    setAdminApiKey(key);

    try {
      await adminAxios.get('/api/admin/dashboard');
      toast.success('Đăng nhập thành công');
      router.replace('/admin');
    } catch (error) {
      toast.error(getAdminErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <Card className='w-full max-w-sm rounded-lg shadow-none'>
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>
            Nhập <code className='text-xs'>X-Admin-Key</code> từ server env{' '}
            <code className='text-xs'>ADMIN_API_KEY</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='admin-key'>Admin API Key</Label>
              <Input
                id='admin-key'
                type='password'
                autoComplete='current-password'
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder='••••••••'
              />
            </div>
            <Button type='submit' className='w-full' isLoading={loading}>
              <Icons.login className='size-4' />
              Đăng nhập
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
