import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, FileText } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/misc'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { SapError, SapSourceBar } from '@/components/sap/SapParts'
import { date, money } from '@/utils/format'
import type { SapInvoiceView } from '@/types/sap'

/** SAP billing documents. `open` limits the list to invoices with an outstanding amount. */
export function InvoiceList({ open }: { open: boolean }) {
  const { user } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const navigate = useNavigate()
  const internal = user.kind === 'internal'
  const q = useSapQuery((ctx) => services.sapData.listInvoices(ctx, { openOnly: open }), [open])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [customer, setCustomer] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [overdue, setOverdue] = useState('')

  const rows = (q.data?.items ?? []).filter(
    (i) =>
      (!search || `${i.invoiceNumber} ${i.soNumber ?? ''} ${i.deliveryNumber ?? ''} ${i.customerReference ?? ''}`.toLowerCase().includes(search.toLowerCase())) &&
      (!status || i.status === status) &&
      (!customer || i.customerId === customer) &&
      (!from || i.invoiceDate.slice(0, 10) >= from) &&
      (!to || i.invoiceDate.slice(0, 10) <= to) &&
      (!dueFrom || i.dueDate.slice(0, 10) >= dueFrom) &&
      (!dueTo || i.dueDate.slice(0, 10) <= dueTo) &&
      (!overdue || (overdue === 'overdue' ? i.daysOverdue > 0 : i.daysOverdue === 0)),
  )
  const currencies = [...new Set(rows.map((r) => r.currency))]
  const totalOut = rows.reduce((s, r) => s + r.outstanding, 0)

  const columns: Column<SapInvoiceView>[] = [
    { key: 'no', header: 'SAP invoice', primary: true, sortValue: (i) => i.invoiceNumber, cell: (i) => <span className="whitespace-nowrap font-mono text-[12px] font-semibold">{i.invoiceNumber}{i.type === 'Credit Memo' && <span className="block font-sans text-[10.5px] font-normal text-muted">Credit memo</span>}</span> },
    ...(internal ? [{ key: 'customer', header: 'Customer', cell: (i: SapInvoiceView) => <span className="font-medium">{lookups.customer(i.customerId)?.name}</span> } as Column<SapInvoiceView>] : []),
    { key: 'date', header: 'Invoice date', sortValue: (i) => i.invoiceDate, cell: (i) => <span className="whitespace-nowrap">{date(i.invoiceDate)}</span> },
    { key: 'due', header: 'Due date', sortValue: (i) => i.dueDate, cell: (i) => <span className="whitespace-nowrap">{i.type === 'Invoice' ? date(i.dueDate) : '—'}</span> },
    { key: 'so', header: 'Sales order / delivery', hideOnMobile: true, cell: (i) => <span className="whitespace-nowrap font-mono text-[11.5px] text-muted">{i.soNumber ?? '—'}<span className="block">{i.deliveryNumber ?? ''}</span></span> },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (i) => i.grossValue, cell: (i) => <span className="whitespace-nowrap tabular">{money(i.grossValue, i.currency)}<span className="block text-[10.5px] text-muted">tax {money(i.taxValue, i.currency)}</span></span> },
    { key: 'paid', header: 'Paid / credited', align: 'right', hideOnMobile: true, sortValue: (i) => i.amountPaid + i.creditsApplied, cell: (i) => <span className="whitespace-nowrap tabular text-muted">{i.type === 'Invoice' ? money(i.amountPaid + i.creditsApplied, i.currency) : '—'}</span> },
    { key: 'out', header: 'Outstanding', align: 'right', sortValue: (i) => i.outstanding, cell: (i) => <span className="whitespace-nowrap font-medium tabular">{i.type === 'Invoice' ? money(i.outstanding, i.currency) : '—'}</span> },
    ...(open ? [{ key: 'days', header: 'Days overdue', align: 'right' as const, sortValue: (i: SapInvoiceView) => i.daysOverdue, cell: (i: SapInvoiceView) => <span className={i.daysOverdue ? 'font-semibold tabular text-danger-700' : 'tabular text-muted'}>{i.daysOverdue || '—'}</span> } as Column<SapInvoiceView>] : []),
    { key: 'status', header: 'Status', sortValue: (i) => i.status, cell: (i) => <StatusBadge status={i.status} /> },
    { key: 'go', header: <span className="sr-only">Actions</span>, align: 'right', cell: () => <span className="inline-flex items-center text-[12px] font-medium text-primary">View<ChevronRight className="size-3.5" /></span> },
  ]
  const active = !!(search || status || customer || from || to || dueFrom || dueTo || overdue)

  return (
    <>
      <PageHeader
        title={open ? 'Open invoices' : 'Invoices'}
        description={open ? 'Unpaid and partially paid SAP invoices. Outstanding amounts reflect payments and credits SAP has allocated.' : 'Official invoices and credit memos issued in SAP.'}
        breadcrumbs={[{ label: 'Finance' }, { label: open ? 'Open invoices' : 'Invoices' }]}
        meta={<SapSourceBar mode={q.data?.mode} syncedAt={q.data?.syncedAt} onRefresh={q.reload} loading={q.loading} />}
      />
      <Card>
        <FilterBar active={active} onReset={() => { setSearch(''); setStatus(''); setCustomer(''); setFrom(''); setTo(''); setDueFrom(''); setDueTo(''); setOverdue('') }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Invoice, order or delivery…" className="w-full sm:w-56" label="Search invoices" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={(open ? ['Open', 'Partially Paid', 'Overdue'] : ['Open', 'Partially Paid', 'Overdue', 'Paid', 'Cancelled']).map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Overdue" value={overdue} onChange={setOverdue} options={[{ value: 'overdue', label: 'Overdue only' }, { value: 'current', label: 'Not overdue' }]} />
          {internal && <FilterSelect label="Customer" value={customer} onChange={setCustomer} options={scope.customers.map((c) => ({ value: c.id, label: c.name }))} />}
          <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
            Invoice date
            <input type="date" aria-label="Invoice date from" value={from} onChange={(e) => setFrom(e.target.value)} className="input h-8 w-34" />–
            <input type="date" aria-label="Invoice date to" value={to} onChange={(e) => setTo(e.target.value)} className="input h-8 w-34" />
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
            Due
            <input type="date" aria-label="Due date from" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} className="input h-8 w-34" />–
            <input type="date" aria-label="Due date to" value={dueTo} onChange={(e) => setDueTo(e.target.value)} className="input h-8 w-34" />
          </span>
        </FilterBar>
        {q.error ? (
          <SapError error={q.error} onRetry={q.reload} />
        ) : (
          <>
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(i) => i.invoiceNumber}
              onRowClick={(i) => navigate(`/app/finance/invoices/${i.invoiceNumber}`)}
              pageSize={12}
              initialSort={open ? { key: 'due', dir: 'asc' } : { key: 'date', dir: 'desc' }}
              caption={open ? 'Open invoices' : 'Invoices'}
              empty={<EmptyState icon={<FileText className="size-5" />} title={q.loading ? 'Loading invoices…' : open ? 'No open invoices' : 'No invoices'} description={active ? 'Try clearing the filters.' : open ? 'Nothing is outstanding on the account(s) in view.' : 'Invoices appear here once SAP bills a delivery.'} />}
            />
            {rows.length > 0 && currencies.length === 1 && (
              <p className="border-t border-line px-4 py-2 text-right text-[12.5px] text-muted">{rows.length} document(s) · outstanding <span className="font-semibold text-ink tabular">{money(totalOut, currencies[0]!)}</span></p>
            )}
          </>
        )}
      </Card>
    </>
  )
}
