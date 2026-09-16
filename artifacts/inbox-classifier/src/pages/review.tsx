import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Filter, Mail, RefreshCw, Search, Tag, UserRoundX } from 'lucide-react';
import { getListClassificationsQueryKey, useApplyLabels, useListClassifications, useUpdateClassification } from '@workspace/api-client-react';
import { AppShell, SectionKicker, SkeletonBlock } from '@/components/app-shell';

const categoryColor = (category: string) => {
  const colors: Record<string, string> = { Work: '#3B8797', Finance: '#B9783F', News: '#806A9E', Shopping: '#5C9B7B', Personal: '#C69742' };
  return colors[category] ?? '#6A8790';
};
const confidenceLabel = (confidence: number) => confidence >= 0.9 ? 'High confidence' : confidence >= 0.72 ? 'Good signal' : 'Needs a look';

export default function ReviewPage() {
  const [category, setCategory] = useState('');
  const [sender, setSender] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const params = useMemo(() => ({ category: category || undefined, sender: sender || undefined, limit: 100 }), [category, sender]);
  const query = useListClassifications(params, { query: { queryKey: getListClassificationsQueryKey(params) } });
  const update = useUpdateClassification();
  const apply = useApplyLabels();
  const queryClient = useQueryClient();
  const rows = useMemo(() => (query.data ?? []).filter((item) => `${item.senderEmail} ${item.subjectPreview}`.toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  const senders = useMemo(() => Array.from(new Set((query.data ?? []).map((item) => item.senderDomain))).sort(), [query.data]);
  const includedRows = rows.filter((row) => row.included);
  const allSelected = includedRows.length > 0 && includedRows.every((row) => selected.includes(row.id));

  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const patchRow = (updated: { id: string; category: string; included: boolean }) => {
    queryClient.setQueryData(query.queryKey, (current: typeof query.data) =>
      current?.map((item) => item.id === updated.id ? { ...item, category: updated.category, included: updated.included } : item),
    );
  };
  const changeCategory = (id: string, value: string) => update.mutate({ classificationId: id, data: { category: value } }, { onSuccess: patchRow });
  const excludeSender = (domain: string) => {
    (query.data ?? []).filter((item) => item.senderDomain === domain && item.included).forEach((item) => update.mutate({ classificationId: item.id, data: { included: false } }, { onSuccess: patchRow }));
  };
  const applyLabels = () => apply.mutate({ data: { classificationIds: selected.length ? selected : includedRows.map((item) => item.id) } }, { onSuccess: () => setSelected([]) });

  return <AppShell><div className="mx-auto max-w-[1240px] animate-enter">
    <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><SectionKicker>Control room / review</SectionKicker><h1 className="text-3xl font-semibold tracking-[-0.055em] sm:text-[40px]">Make the call, then move on.</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">A quick pass over classifications before they become Gmail labels. Change one, exclude a sender, or trust the batch.</p></div><button type="button" onClick={applyLabels} disabled={apply.isPending || includedRows.length === 0} data-testid="button-apply-labels" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_hsl(var(--primary)/.18)] transition-transform hover:-translate-y-0.5 disabled:opacity-45"><Tag className="h-4 w-4" />{apply.isPending ? 'Applying…' : `Apply labels${selected.length ? ` (${selected.length})` : ''}`}</button></div>
    {apply.data && <div className="mb-5 flex items-center gap-3 rounded-lg border border-[#5C9B7B]/30 bg-[#E6F0EC] px-4 py-3 text-sm text-[#35654E]" data-testid="status-label-apply"><Check className="h-4 w-4" />{apply.data.message ?? `${apply.data.messagesLabeled} messages are now labeled.`}</div>}
    {query.isError && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5" data-testid="state-review-error"><p className="text-sm font-semibold text-destructive">The review queue is unavailable.</p><button type="button" onClick={() => query.refetch()} data-testid="button-retry-review" className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold">Retry</button></div>}
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_30px_hsl(var(--foreground)/.035)]">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5 lg:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sender or subject" data-testid="input-review-search" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none ring-primary/20 placeholder:text-muted-foreground/70 focus:ring-2" /></div><div className="flex gap-2"><div className="relative flex-1 sm:w-44"><Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><select value={category} onChange={(event) => setCategory(event.target.value)} data-testid="select-review-category" className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-9 pr-8 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"><option value="">All categories</option>{Array.from(new Set((query.data ?? []).map((row) => row.category))).sort().map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /></div><div className="relative flex-1 sm:w-44"><select value={sender} onChange={(event) => setSender(event.target.value)} data-testid="select-review-sender" className="h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-8 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"><option value="">All senders</option>{senders.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 text-muted-foreground" /></div></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/35 px-4 py-3 text-xs sm:px-5"><button type="button" onClick={() => setSelected(allSelected ? [] : includedRows.map((item) => item.id))} data-testid="button-select-visible" className="font-semibold text-primary hover:underline">{allSelected ? 'Clear selection' : 'Select included'}</button><span className="text-muted-foreground">{rows.length} messages · {includedRows.length} included</span></div>
      {query.isLoading && <div className="space-y-3 p-5" data-testid="state-review-loading">{[1, 2, 3, 4].map((item) => <SkeletonBlock key={item} className="h-16 w-full" />)}</div>}
      {!query.isLoading && rows.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center" data-testid="state-review-empty"><Mail className="mb-3 h-7 w-7 text-muted-foreground/45" /><p className="text-sm font-semibold">Nothing needs your attention here.</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Try a different filter, or scan the inbox to create a fresh review queue.</p></div>}
      {!query.isLoading && rows.length > 0 && <div className="divide-y divide-border">
        {rows.map((row) => <div key={row.id} className={`group grid gap-3 px-4 py-4 transition-colors hover:bg-muted/35 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-5 ${!row.included ? 'opacity-45' : ''}`} data-testid={`row-classification-${row.id}`}>
          <button type="button" aria-label={selected.includes(row.id) ? 'Deselect message' : 'Select message'} onClick={() => toggleSelected(row.id)} disabled={!row.included} data-testid={`button-select-${row.id}`} className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${selected.includes(row.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'}`}>{selected.includes(row.id) && <Check className="h-3 w-3" />}</button>
          <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold">{row.senderEmail}</span><span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{row.senderDomain}</span><span className="hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline" style={{ color: categoryColor(row.category), backgroundColor: `${categoryColor(row.category)}18` }}>{confidenceLabel(row.confidence)}</span></div><p className="mt-1 truncate text-sm text-muted-foreground">{row.subjectPreview}</p><p className="mt-1 text-[11px] text-muted-foreground/65">{row.subcategory ?? 'General'} · {Math.round(row.confidence * 100)}% confidence</p></div>
          <div className="flex items-center gap-2 sm:justify-end"><select value={row.category} onChange={(event) => changeCategory(row.id, event.target.value)} disabled={update.isPending} data-testid={`select-category-${row.id}`} className="h-9 max-w-[130px] rounded-md border border-input bg-background px-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20">{Array.from(new Set((query.data ?? []).map((item) => item.category))).sort().map((item) => <option key={item} value={item}>{item}</option>)}</select><button type="button" onClick={() => excludeSender(row.senderDomain)} disabled={!row.included || update.isPending} data-testid={`button-exclude-${row.id}`} title="Exclude sender" className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:opacity-40"><UserRoundX className="h-4 w-4" /></button></div>
        </div>)}
      </div>}
    </section>
  </div></AppShell>;
}
