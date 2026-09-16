import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, Archive, ChevronRight, CircleHelp, Inbox, LockKeyhole, Settings2, Sparkles } from 'lucide-react';

function BrandMark() {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_6px_16px_hsl(var(--sidebar-primary)/.18)]">
      <Inbox className="h-5 w-5" strokeWidth={2.2} />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sidebar-accent ring-2 ring-sidebar" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const nav = [
    { href: '/', label: 'Overview', icon: Activity },
    { href: '/review', label: 'Review queue', icon: Archive },
    { href: '/settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 px-6 py-7">
          <BrandMark />
          <div>
            <div className="font-semibold tracking-[-0.03em] text-sidebar-foreground">Inbox Classifier</div>
            <div className="mono-label mt-1 text-sidebar-foreground/50">private by default</div>
          </div>
        </div>
        <div className="px-4">
          <div className="mono-label px-3 pb-2 text-sidebar-foreground/35">Workspace</div>
          <nav className="space-y-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  data-testid={`link-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/62 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-sidebar-primary' : 'text-sidebar-foreground/42 group-hover:text-sidebar-primary'}`} />
                  <span>{label}</span>
                  {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto space-y-4 px-6 pb-7">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/55 p-4">
            <div className="flex items-center gap-2 text-xs font-medium">
              <LockKeyhole className="h-3.5 w-3.5 text-sidebar-primary" />
              <span>Body-free by design</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/52">
              We keep metadata and categories, never the message itself.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/38">
            <CircleHelp className="h-3.5 w-3.5" />
            <span>Need a hand?</span>
            <span className="ml-auto font-mono text-[10px]">v0.1</span>
          </div>
        </div>
      </aside>

      <div className="md:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md sm:px-8 lg:px-11">
          <div className="flex items-center gap-3 md:hidden">
            <BrandMark />
            <span className="font-semibold tracking-[-0.03em]">Inbox Classifier</span>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Quietly making sense of your inbox</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5C9B7B]" />
            <span>Connection secure</span>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border/70 bg-background px-5 py-2 md:hidden">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              data-testid={`link-mobile-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${location === href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <main className="app-grid min-h-[calc(100dvh-68px)] px-5 py-7 sm:px-8 sm:py-9 lg:px-11">{children}</main>
      </div>
    </div>
  );
}

export function SectionKicker({ children }: { children: ReactNode }) {
  return <div className="mono-label mb-2 text-muted-foreground">{children}</div>;
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton-line rounded-md ${className}`} aria-hidden="true" />;
}
