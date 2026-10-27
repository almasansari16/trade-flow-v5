import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, ChevronRight } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState, Notice } from '@/components/ui/misc'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { SapError, SapSourceBar } from '@/components/sap/SapParts'
import { date, money } from '@/utils/format'
import type { SapPaymentView } from '@/types/sap'

export default function SapPaymentsPage() {
  const { user, can } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const navigate = useNavigate()
  const internal = user.kind === 'internal'
  const q = useSapQuery((ctx) => services.sapData.listPayments(ctx), [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [customer, setCustomer] = useState('')
  const rows = (q.data?.items ?? []).filter((p) => (!search || `${p.paymentDoc} ${p.reference} ${p.allocations.map((a) => a.invoiceNumber).join(' ')}`.toLowerCase().includes(search.toLowerCase())) && (!status || p.status === status) && (!customer || p.customerId === customer))
  const columns: Column<SapPaymentView>[] = [
    { key: 'doc', header: 'SAP payment document', primary: true, sortValue: (p) => p.paymentDoc, cell: (p) => <span className="whitespace-nowrap font-mono text-[12px] font-semibold">{p.paymentDoc}</span> },
    ...(internal ? [{ key: 'customer', header: 'Customer', cell: (p: SapPaymentView) => <span className="font-medium">{lookups.customer(p.customerId)?.name}</span> } as Column<SapPaymentView>] : []),
    { key: 'date', header: 'Payment date', sortValue: (p) => p.paymentDate, cell: (p) => <span className="whitespace-nowrap">{date(p.paymentDate)}<span className="block text-[10.5px] text-muted">posted {date(p.postingDate)}</span></span> },
    { key: 'ref', header: 'Reference', cell: (p) => <span className="text-[12.5px]">{p.reference}<span className="block text-[11px] text-muted">{p.method}</span></span> },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (p) => p.amount, cell: (p) => <span className="whitespace-nowrap font-medium tabular">{money(p.amount, p.currency)}</span> },
    { key: 'alloc', header: 'Allocated to', hideOnMobile: true, cell: (p) => (p.allocations.length ? <span className="font-mono text-[11.5px]">{p.allocations.map((a) => a.invoiceNumber).join(', ')}</span> : <span className="text-muted">—</span>) },
    { key: 'un', header: 'Unallocated', align: 'right', hideOnMobile: true, cell: (p) => <span className={p.unallocated ? 'tabular text-warning-700' : 'tabular text-muted'}>{money(p.unallocated, p.currency)}</span> },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'go', header: <span className="sr-only">Actions</span>, align: 'right', cell: () => <span className="inline-flex items-center text-[12px] font-medium text-primary">View<ChevronRight className="size-3.5" /></span> },
  ]
  return (
    <>
      <PageHeader
        title="Payments"
        description="Payments posted against the account in SAP and the invoices they were applied to."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Payments' }]}
        meta={<SapSourceBar mode={q.data?.mode} syncedAt={q.data?.syncedAt} onRefresh={q.reload} loading={q.loading} />}
      />
      {can('payment.upload_receipt') && (
        <Notice tone="info" className="mb-3">
          Sent a payment that is not listed yet? It appears here once SAP posts it. You can submit proof of payment under <Link to="/app/payments" className="font-medium text-primary hover:underline">Payment advice</Link> — it stays <em>pending verification</em> and does not mark any invoice as paid.
        </Notice>
      )}
      <Card>
        <FilterBar active={!!(search || status || customer)} onReset={() => { setSearch(''); setStatus(''); setCustomer('') }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Document, reference or invoice…" className="w-full sm:w-64" label="Search payments" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={['Fully Allocated', 'Partially Allocated', 'Unallocated', 'Reversed'].map((s) => ({ value: s, label: s }))} />
          {internal && <FilterSelect label="Customer" value={customer} onChange={setCustomer} options={scope.customers.map((c) => ({ value: c.id, label: c.name }))} />}
        </FilterBar>
        {q.error ? <SapError error={q.error} onRetry={q.reload} /> : (
          <DataTable rows={rows} columns={columns} rowKey={(p) => p.paymentDoc} onRowClick={(p) => navigate(`/app/finance/payments/${p.paymentDoc}`)} pageSize={12} initialSort={{ key: 'date', dir: 'desc' }} caption="Payments"
            empty={<EmptyState icon={<Banknote className="size-5" />} title={q.loading ? 'Loading payments…' : 'No payments posted'} description="Payments appear once SAP posts them to the account." />} />
        )}
      </Card>
    </>
  )
}
