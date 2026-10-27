import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { DemoTag, StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/misc'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { FilterBar, SearchInput } from '@/components/data-display/FilterBar'
import { toUsd } from '@/utils/fx'
import { date, money } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { ProformaInvoice } from '@/types/domain'

type TabKey = 'all' | 'open' | 'uploaded' | 'verified'

export default function InvoicesPage() {
  const scope = useScope()
  const { user } = useStore()
  const lookups = useLookups()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('all')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => scope.invoices.filter((i) => !q || `${i.number} ${lookups.customer(i.customerId)?.name} ${lookups.request(i.requestId)?.ref}`.toLowerCase().includes(q.toLowerCase())), [scope.invoices, q, lookups])
  const match: Record<TabKey, (i: ProformaInvoice) => boolean> = {
    all: () => true,
    open: (i) => i.status === 'Issued',
    uploaded: (i) => i.status === 'Receipt Uploaded',
    verified: (i) => i.status === 'Payment Verified',
  }
  const rows = filtered.filter(match[tab])
  const overdue = (i: ProformaInvoice) => i.status === 'Issued' && new Date(i.dueAt).getTime() < Date.now()

  const columns: Column<ProformaInvoice>[] = [
    { key: 'num', header: 'Proforma', primary: true, sortValue: (i) => i.number, cell: (i) => <span className="font-mono text-[12px] font-semibold">{i.number}</span> },
    ...(user.kind !== 'external' ? [{ key: 'customer', header: 'Customer', sortValue: (i: ProformaInvoice) => lookups.customer(i.customerId)?.name ?? '', cell: (i: ProformaInvoice) => <span className="font-medium">{lookups.customer(i.customerId)?.name}</span> } as Column<ProformaInvoice>] : []),
    { key: 'req', header: 'Request', hideOnMobile: true, cell: (i) => <span className="font-mono text-[12px] text-muted">{lookups.request(i.requestId)?.ref}</span> },
    { key: 'issued', header: 'Issued', sortValue: (i) => i.issuedAt, cell: (i) => date(i.issuedAt) },
    { key: 'due', header: 'Due', sortValue: (i) => i.dueAt, cell: (i) => <span className={cn(overdue(i) && 'font-medium text-danger-700')}>{date(i.dueAt)}{overdue(i) && ' · overdue'}</span> },
    { key: 'total', header: 'Total', align: 'right', sortValue: (i) => toUsd(i.total, i.currency), cell: (i) => <span className="font-medium tabular">{money(i.total, i.currency)}</span> },
    { key: 'status', header: 'Status', sortValue: (i) => i.status, cell: (i) => <StatusBadge status={i.status} /> },
  ]

  const sum = (xs: ProformaInvoice[]) => xs.reduce((s, i) => s + toUsd(i.total, i.currency), 0)

  return (
    <>
      <PageHeader title="Proforma requests" description="Advance-payment requests issued from TradeFlow for customers on advance terms. They are not tax invoices — official invoices are issued in SAP (Finance › Invoices)." breadcrumbs={[{ label: 'Finance' }, { label: 'Proforma requests' }]} meta={<DemoTag>TradeFlow documents · not SAP</DemoTag>} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          ['Awaiting payment', sum(scope.invoices.filter(match.open)), 'text-ink'],
          ['Receipt uploaded — pending verification', sum(scope.invoices.filter(match.uploaded)), 'text-primary-700'],
          ['Payment verified', sum(scope.invoices.filter(match.verified)), 'text-success-700'],
        ].map(([l, v, c]) => (
          <div key={l as string} className="card p-4">
            <p className="text-xs text-muted">{l as string}</p>
            <p className={cn('mt-1 text-xl font-semibold tabular', c as string)}>{money(v as number, 'USD', { compact: true })}</p>
            <p className="text-[11px] text-muted">USD equivalent</p>
          </div>
        ))}
      </div>
      <Card>
        <Tabs
          className="px-3"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: 'All', count: filtered.length },
            { key: 'open', label: 'Awaiting payment', count: filtered.filter(match.open).length },
            { key: 'uploaded', label: 'Receipt uploaded', count: filtered.filter(match.uploaded).length },
            { key: 'verified', label: 'Verified', count: filtered.filter(match.verified).length },
          ]}
        />
        <FilterBar active={!!q} onReset={() => setQ('')}>
          <SearchInput value={q} onChange={setQ} placeholder="Invoice, request or customer…" className="w-full sm:w-72" />
        </FilterBar>
        <DataTable
          key={tab}
          rows={rows}
          columns={columns}
          rowKey={(i) => i.id}
          onRowClick={(i) => navigate(`/app/invoices/${i.id}`)}
          initialSort={{ key: 'issued', dir: 'desc' }}
          empty={<EmptyState icon={<Receipt className="size-5" />} title="No proforma invoices" description="They are issued by Finance once a request is fully approved." />}
        />
      </Card>
    </>
  )
}
