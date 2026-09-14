'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hasAdminApiKey } from '@/lib/admin-auth';
import { Spinner } from '@/components/ui/spinner';
import { AdminSidebar } from './admin-sidebar';

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    if (isLogin) {
      if (hasAdminApiKey()) {
        router.replace('/admin');
        return;
      }
      setReady(true);
      return;
    }

    if (!hasAdminApiKey()) {
      router.replace('/admin/login');
      return;
    }
    setReady(true);
  }, [isLogin, router, pathname]);

  if (!ready) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-background'>
        <Spinner className='size-6' />
      </div>
    );
  }

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className='flex min-h-screen bg-background text-foreground'>
      <AdminSidebar />
      <main className='min-w-0 flex-1 overflow-auto'>
        <div className='mx-auto max-w-6xl p-6'>{children}</div>
      </main>
    </div>
  );
}
