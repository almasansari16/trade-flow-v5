import { useState } from 'react'
import { CloudUpload, FlaskConical, Loader2, RefreshCw } from 'lucide-react'
import { canSubmitToSap, useLookups, useStore } from '@/app/store'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/misc'
import { useToast } from '@/components/ui/Toast'
import { SAP_MODE, SAP_MODE_LABEL } from '@/services'
import { dateTime, money } from '@/utils/format'
import { Link } from 'react-router-dom'
import type { SapSalesOrder } from '@/types/sap'
import type { SalesOrderRequest } from '@/types/domain'

/** Customer-facing wording: no error codes or technical messages (requirements §13). */
const CUSTOMER_TEXT: Record<string, string> = {
  'Pending SAP Creation': 'Approved. Your sales order is being created in SAP.',
  'SAP Creation Failed': 'Approved. Creating the sales order is taking longer than usual — our team is on it; there is no need to submit the request again.',
  'Sales Order Created': 'Your sales order has been created.',
}

export function SapSubmissionPanel({ request: r, sapOrder, sapError }: { request: SalesOrderRequest; sapOrder?: SapSalesOrder; sapError?: string }) {
  const { state, user, submitToSap } = useStore()
  const lookups = useLookups()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!r.sap) return null
  const sap = r.sap
  const external = user.kind === 'external'
  const allowed = canSubmitToSap(state, user, r)
  const inFlight = busy || sap.inFlight

  const run = async () => {
    setBusy(true)
    const res = await submitToSap(r.id)
    setBusy(false)
    if (!res.ok) return toast.error('SAP submission not started', res.error)
    if (res.outcome === 'failed') toast.error('SAP submission failed', res.message)
    else toast.success(res.outcome === 'existing_returned' ? 'SAP already had this order — no duplicate created' : res.outcome === 'confirmed' ? 'SAP sales order created (development mock)' : 'SAP sales order created with partial confirmation (development mock)', res.message)
  }

  const soStatus = sapOrder ? (sapOrder.status === 'Open' ? 'Sales Order Created' : sapOrder.status) : sap.documentNumber ? 'Sales Order Created' : sap.status
  if (external)
    return (
      <Card>
        <CardHeader title="Sales order" actions={<StatusBadge status={sap.status === 'SAP Creation Failed' ? 'Pending SAP Creation' : soStatus} />} />
        <CardBody className="space-y-2 text-[13px]">
          <p>{CUSTOMER_TEXT[sap.status]}</p>
          <dl className="space-y-1">
            <div className="flex justify-between gap-3"><dt className="text-muted">TradeFlow request</dt><dd className="font-mono text-[12px]">{r.ref}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Approval</dt><dd>Approved</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">SAP sales order</dt><dd className="font-mono text-[12px]">{sap.documentNumber ?? 'Not created yet'}</dd></div>
            {sap.documentNumber && <div className="flex justify-between gap-3"><dt className="text-muted">SAP order status</dt><dd>{sapOrder ? <StatusBadge status={soStatus} /> : sapError ? <span className="text-xs text-muted">Unavailable right now</span> : '…'}</dd></div>}
            {sapOrder && <div className="flex justify-between gap-3"><dt className="text-muted">Created</dt><dd>{dateTime(sapOrder.createdAt)}</dd></div>}
            {sapOrder && <div className="flex justify-between gap-3"><dt className="text-muted">Approved order value</dt><dd className="tabular">{money(sapOrder.netValue, sapOrder.currency)} <span className="text-[11px] text-muted">net</span></dd></div>}
          </dl>
          {sap.documentNumber && <Link to={`/app/orders/${sap.documentNumber}`} className="inline-block text-[13px] font-medium text-primary hover:underline">Open sales order</Link>}
          {SAP_MODE === 'mock' && sap.documentNumber && <p className="text-[11px] text-muted">Development mode: this order number comes from the SAP development mock.</p>}
        </CardBody>
      </Card>
    )

  return (
    <Card>
      <CardHeader
        title="SAP sales order"
        description="Created after internal approval; tracked separately"
        actions={<StatusBadge status={inFlight ? 'Creating in SAP…' : sap.status} />}
      />
      <CardBody className="space-y-3 text-[13px]">
        <p className="flex items-center gap-1.5 text-xs text-muted"><FlaskConical className="size-3.5 shrink-0" />{SAP_MODE_LABEL}</p>
        {sap.documentNumber && (
          <div className="flex justify-between"><span className="text-muted">Sales order</span><Link to={`/app/orders/${sap.documentNumber}`} className="font-mono text-primary hover:underline">{sap.documentNumber}</Link></div>
        )}
        {sapOrder && <div className="flex justify-between"><span className="text-muted">SAP order status</span><StatusBadge status={soStatus} /></div>}
        {sap.documentNumber && sap.fullyConfirmed === false && <p className="text-xs text-warning-700">Some quantities were only partially confirmed by SAP.</p>}
        {sap.idempotencyKey && <div className="flex justify-between text-xs"><span className="text-muted">Idempotency key</span><span className="font-mono">{sap.idempotencyKey}</span></div>}
        {sap.soldTo !== undefined || sap.attempts.length ? <div className="flex justify-between text-xs"><span className="text-muted">Sold-to BP</span><span className="font-mono">{sap.soldTo ?? 'not mapped'}</span></div> : null}
        {sap.status === 'SAP Creation Failed' && sap.errorMessage && (
          <Notice tone="danger" title={`Last attempt failed${sap.errorCode ? ` · ${sap.errorCode}` : ''}`}>{sap.errorMessage}</Notice>
        )}
        {sap.status === 'Pending SAP Creation' && !inFlight && <p className="text-muted">Internally approved. Not yet sent to SAP — no SAP document exists.</p>}
        {allowed && (
          <Button size="sm" icon={inFlight ? <Loader2 className="size-4 animate-spin" /> : sap.attempts.length ? <RefreshCw className="size-4" /> : <CloudUpload className="size-4" />} disabled={inFlight} onClick={run}>
            {inFlight ? 'Creating in SAP…' : sap.attempts.length ? 'Retry SAP order creation' : 'Create sales order in SAP'}
          </Button>
        )}
        {!allowed && !inFlight && (sap.status === 'Pending SAP Creation' || sap.status === 'SAP Creation Failed') && (
          <p className="text-xs text-muted">Waiting for a Sales Representative, Head of Sales or Operations user to submit.</p>
        )}
        {sap.attempts.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Attempts</p>
            <ol className="space-y-1.5">
              {[...sap.attempts].reverse().map((a, i) => (
                <li key={i} className="rounded-md border border-line px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={a.outcome === 'failed' ? 'danger' : a.outcome === 'partially_confirmed' ? 'info' : 'success'}>{a.outcome === 'failed' ? 'Failed' : a.outcome === 'confirmed' ? 'Created' : a.outcome === 'existing_returned' ? 'Existing order returned' : 'Created · partial confirmation'}</Badge>
                    <span className="text-[11px] text-muted">{dateTime(a.at)}</span>
                  </div>
                  <p className="mt-1 text-xs">{a.message}</p>
                  <p className="text-[11px] text-muted">by {lookups.user(a.byId)?.name ?? 'System'} · {a.mode === 'mock' ? 'development mock' : 'live'}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
