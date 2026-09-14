'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { clearAdminApiKey } from '@/lib/admin-auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: Icons.dashboard, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: Icons.billing },
  { href: '/admin/lookup', label: 'Lookup', icon: Icons.search },
  { href: '/admin/activate', label: 'Activate', icon: Icons.shield }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearAdminApiKey();
    router.replace('/admin/login');
  }

  return (
    <aside className='flex w-56 shrink-0 flex-col border-r border-border bg-background'>
      <div className='border-b border-border px-4 py-4'>
        <p className='text-sm font-semibold tracking-tight'>LocketGold Admin</p>
        <p className='text-muted-foreground text-xs'>Internal panel</p>
      </div>

      <nav className='flex flex-1 flex-col gap-1 p-2'>
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <Icon className='size-4' />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className='border-t border-border p-2'>
        <Button
          variant='ghost'
          className='w-full justify-start'
          onClick={handleLogout}
        >
          <Icons.logout className='size-4' />
          Đăng xuất
        </Button>
      </div>
    </aside>
  );
}
