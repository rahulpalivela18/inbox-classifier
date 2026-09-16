import { useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowUpRight, Check, Clock3, Inbox, LockKeyhole, Mail, Play, RefreshCw, ShieldCheck, Tag } from 'lucide-react';
import { useCreateScan, useGetDashboard, useListScans } from '@workspace/api-client-react';
import { AppShell, SectionKicker, SkeletonBlock } from '@/components/app-shell';

const formatDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Not yet';

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const dashboardQuery = useGetDashboard();
  const scansQuery = useListScans();
  const createScan = useCreateScan();
  const dashboard = dashboardQuery.data;
  const latestScan = useMemo(() => scansQuery.data?.[0], [scansQuery.data]);

  const startScan = () => {
    createScan.mutate(
      { data: { scope: 'inbox', maxMessages: 5000 } },
      { onSuccess: (scan) => setLocation(`/scan/${scan.id}`) },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1240px] animate-enter">
        <div className="mb-9 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <SectionKicker>Control room / overview</SectionKicker>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.055em] text-foreground sm:text-[42px] sm:leading-[1.04]">
              A calmer read on what is waiting.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Turn noisy inbox metadata into a short list of clear next actions. No message bodies are retained.
            </p>
          </div>
          <button
            type="button"
            onClick={startScan}
            disabled={createScan.isPending || !dashboard?.account.connected}
            data-testid="button-start-scan"
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_hsl(var(--primary)/.18)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createScan.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            {createScan.isPending ? 'Starting scan…' : 'Scan inbox'}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>

        {dashboardQuery.isLoading && (
          <div className="space-y-5" data-testid="state-dashboard-loading">
            <SkeletonBlock className="h-32 w-full" />
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><SkeletonBlock className="h-72" /><SkeletonBlock className="h-72" /></div>
          </div>
        )}
        {dashboardQuery.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6" data-testid="state-dashboard-error">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive"><RefreshCw className="h-4 w-4" /> We could not read the inbox overview.</div>
            <p className="mt-2 text-sm text-muted-foreground">Check the connection and try again.</p>
            <button type="button" onClick={() => dashboardQuery.refetch()} data-testid="button-retry-dashboard" className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">Retry</button>
          </div>
        )}
        {dashboard && (
          <>
            {!dashboard.account.connected && (
              <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-[#D7B75D]/45 bg-[#F7EBC4]/45 p-5 sm:flex-row sm:items-center" data-testid="status-inbox-disconnected">
                <div><div className="text-sm font-semibold">Connect Gmail to begin</div><p className="mt-1 text-sm text-muted-foreground">Your existing aggregate view will stay here until you connect.</p></div>
                <Link href="/settings" data-testid="link-connect-gmail" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Open settings <ArrowUpRight className="h-4 w-4" /></Link>
              </div>
            )}
            <section className="grid overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_30px_hsl(var(--foreground)/.04)] sm:grid-cols-3" data-testid="card-inbox-overview">
              {[
                { label: 'Messages in view', value: dashboard.totalEmails.toLocaleString(), icon: Inbox, tint: 'text-primary' },
                { label: 'Unread needing a look', value: dashboard.unreadEmails.toLocaleString(), icon: Mail, tint: 'text-[#B9783F]' },
                { label: 'Recurring senders', value: dashboard.recurringSenders.toLocaleString(), icon: RefreshCw, tint: 'text-[#5C9B7B]' },
              ].map(({ label, value, icon: Icon, tint }, index) => (
                <div key={label} className={`flex items-center gap-4 p-5 sm:p-6 ${index < 2 ? 'border-b sm:border-b-0 sm:border-r' : ''}`} data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${tint}`}><Icon className="h-5 w-5" /></div>
                  <div><div className="text-2xl font-semibold tracking-[-0.04em]">{value}</div><div className="mt-0.5 text-xs text-muted-foreground">{label}</div></div>
                </div>
              ))}
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <section className="rounded-xl border border-border bg-card p-5 shadow-[0_12px_30px_hsl(var(--foreground)/.035)] sm:p-6" data-testid="card-category-aggregates">
                <div className="flex items-start justify-between">
                  <div><SectionKicker>Signal map</SectionKicker><h2 className="text-lg font-semibold tracking-[-0.035em]">Where the inbox energy goes</h2></div>
                  <Link href="/review" data-testid="link-review-categories" className="text-xs font-semibold text-primary hover:underline">Review all</Link>
                </div>
                {dashboard.categories.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center text-center" data-testid="state-categories-empty"><Tag className="mb-3 h-6 w-6 text-muted-foreground/50" /><p className="text-sm font-medium">No categories yet</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">Run a scan to see your inbox’s patterns take shape.</p></div>
                ) : (
                  <div className="mt-7 space-y-4">
                    {dashboard.categories.map((category) => {
                      const share = Math.round((category.share ?? (dashboard.totalEmails ? category.count / dashboard.totalEmails : 0)) * 100);
                      return <div key={category.id} data-testid={`category-row-${category.id}`}>
                        <div className="mb-1.5 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span><span className="font-mono text-xs text-muted-foreground">{category.count.toLocaleString()} <span className="ml-1 text-muted-foreground/60">{share}%</span></span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(share, 2)}%`, backgroundColor: category.color }} /></div>
                      </div>;
                    })}
                  </div>
                )}
              </section>
              <section className="rounded-xl border border-border bg-card p-5 shadow-[0_12px_30px_hsl(var(--foreground)/.035)] sm:p-6" data-testid="card-latest-scan">
                <SectionKicker>Latest movement</SectionKicker><h2 className="text-lg font-semibold tracking-[-0.035em]">Scan ledger</h2>
                {(latestScan || dashboard.lastScan) ? (
                  <div className="mt-7">
                    <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F0EC] text-[#40785E]"><Check className="h-5 w-5" /></div><div><div className="text-sm font-semibold">{latestScan?.status === 'running' ? 'Scan in progress' : 'Inbox classified'}</div><div className="mt-0.5 text-xs text-muted-foreground">{formatDate(latestScan?.completedAt ?? dashboard.lastScan)}</div></div></div>
                    <div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted/70 p-3"><div className="mono-label text-muted-foreground">Processed</div><div className="mt-1 text-lg font-semibold">{latestScan?.processedMessages?.toLocaleString() ?? dashboard.totalEmails.toLocaleString()}</div></div><div className="rounded-lg bg-muted/70 p-3"><div className="mono-label text-muted-foreground">Labels live</div><div className="mt-1 text-lg font-semibold">{dashboard.labelsApplied.toLocaleString()}</div></div></div>
                    {latestScan?.status === 'running' && <Link href={`/scan/${latestScan.id}`} data-testid="link-open-scan" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Watch progress <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
                  </div>
                ) : <div className="flex min-h-48 flex-col items-center justify-center text-center" data-testid="state-scan-empty"><Clock3 className="mb-3 h-6 w-6 text-muted-foreground/45" /><p className="text-sm font-medium">No scans yet</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">Your first pass will only use sender, subject, and timing metadata.</p></div>}
              </section>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <section className="rounded-xl border border-border bg-[#E7F0F0]/60 p-5 sm:p-6" data-testid="card-privacy-note">
                <div className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><ShieldCheck className="h-5 w-5" /></div><div><SectionKicker>Privacy boundary</SectionKicker><h2 className="text-base font-semibold">Your inbox stays yours.</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{dashboard.privacyNote ?? 'Inbox Classifier reads metadata only. Message bodies are never stored, indexed, or used to train anything.'}</p></div></div>
              </section>
              <section className="rounded-xl border border-border bg-card p-5 sm:p-6" data-testid="card-account-status">
                <div className="flex items-center justify-between"><div><SectionKicker>Connected account</SectionKicker><h2 className="text-base font-semibold">{dashboard.account.email ?? 'No account connected'}</h2></div><LockKeyhole className="h-5 w-5 text-[#5C9B7B]" /></div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span>Last synced</span><span className="font-mono">{formatDate(dashboard.account.lastSyncedAt)}</span></div>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
