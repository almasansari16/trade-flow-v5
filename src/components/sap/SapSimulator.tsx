import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { sapSimulator } from '@/services/sapDevMock'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

/**
 * DEVELOPMENT ONLY — stands in for business events that happen inside SAP (deliveries, billing,
 * incoming payments, outages) so the portal's SAP-driven screens can be exercised end to end.
 * Rendered only while the SAP service runs in mock mode; never part of a live configuration.
 */
export function SapSimulator() {
  const { state } = useStore()
  const lookups = useLookups()
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const snap = sapSimulator.state()
  void tick
  const [so, setSo] = useState('')
  const [dl, setDl] = useState('')
  const [inv, setInv] = useState('')
  const [cust, setCust] = useState('c-001')
  const [amount, setAmount] = useState('5000')
  const [allocate, setAllocate] = useState(true)
  const done = (msg: string) => {
    setTick((t) => t + 1)
    toast.info('SAP development mock', msg)
  }
  const openOrders = snap.orders.filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled')
  const shippable = snap.deliveries.filter((d) => d.status === 'In Picking' || d.status === 'Goods Issued')
  const cancellable = snap.invoices.filter((i) => i.status !== 'Paid')
  const label = (customerId: string) => lookups.customer(customerId)?.name ?? customerId

  return (
    <Card className="border-dashed border-primary/40">
      <CardHeader title="SAP development simulator" description="Development mode only. Simulates events that would happen in SAP; writes to the SAP development mock, never to SAP." icon={<FlaskConical className="size-4" />} />
      <CardBody className="grid gap-4 text-[13px] lg:grid-cols-2">
        <section className="space-y-2">
          <p className="eyebrow">Connectivity & order creation</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={snap.available} onChange={(e) => { sapSimulator.setAvailable(e.target.checked); done(e.target.checked ? 'SAP marked available.' : 'SAP marked unavailable — portal SAP screens show an outage state.') }} /> SAP available</label>
          <label className="flex flex-wrap items-center gap-2">Next sales-order creation
            <select aria-label="Next sales-order creation" className="input h-8 w-64" value={snap.failNext ?? ''} onChange={(e) => { sapSimulator.failNext((e.target.value || null) as 'timeout' | 'timeout_after_commit' | null); done(e.target.value ? `Next creation will fail: ${e.target.value}.` : 'Next creation behaves normally.') }}>
              <option value="">Normal</option>
              <option value="timeout">Timeout — nothing created</option>
              <option value="timeout_after_commit">Timeout after SAP created the order</option>
            </select>
          </label>
        </section>
        <section className="space-y-2">
          <p className="eyebrow">Delivery</p>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Sales order for delivery" className="input h-8 w-72" value={so} onChange={(e) => setSo(e.target.value)}>
              <option value="">Sales order…</option>
              {openOrders.map((o) => <option key={o.soNumber} value={o.soNumber}>{o.soNumber} · {label(o.customerId)} · {o.status}</option>)}
            </select>
            <Button size="sm" variant="secondary" disabled={!so} onClick={() => done(sapSimulator.postDelivery(so, 'full'))}>Post delivery (all open)</Button>
            <Button size="sm" variant="secondary" disabled={!so} onClick={() => done(sapSimulator.postDelivery(so, 'partial'))}>Post partial delivery</Button>
            <Button size="sm" variant="secondary" disabled={!so} onClick={() => done(sapSimulator.createInvoice(so))}>Run billing</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Delivery to mark delivered" className="input h-8 w-72" value={dl} onChange={(e) => setDl(e.target.value)}>
              <option value="">Delivery…</option>
              {shippable.map((d) => <option key={d.deliveryNumber} value={d.deliveryNumber}>{d.deliveryNumber} · {d.soNumber} · {d.status}</option>)}
            </select>
            <Button size="sm" variant="secondary" disabled={!dl} onClick={() => done(sapSimulator.markDelivered(dl))}>Record proof of delivery</Button>
          </div>
        </section>
        <section className="space-y-2">
          <p className="eyebrow">Incoming payment</p>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Customer for payment" className="input h-8 w-56" value={cust} onChange={(e) => setCust(e.target.value)}>
              {state.customers.filter((c) => c.sapBusinessPartner).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input aria-label="Payment amount" className="input h-8 w-28" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={allocate} onChange={(e) => setAllocate(e.target.checked)} /> Clear oldest invoices</label>
            <Button size="sm" variant="secondary" disabled={!(Number(amount) > 0)} onClick={() => done(sapSimulator.postPayment(cust, Number(amount), allocate, 'Simulated incoming payment'))}>Post payment</Button>
          </div>
        </section>
        <section className="space-y-2">
          <p className="eyebrow">Billing correction</p>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Invoice to cancel" className="input h-8 w-72" value={inv} onChange={(e) => setInv(e.target.value)}>
              <option value="">Invoice…</option>
              {cancellable.map((i) => <option key={i.invoiceNumber} value={i.invoiceNumber}>{i.invoiceNumber} · {label(i.customerId)} · {i.status}</option>)}
            </select>
            <Button size="sm" variant="secondary" disabled={!inv} onClick={() => done(sapSimulator.cancelInvoice(inv))}>Cancel invoice</Button>
          </div>
        </section>
      </CardBody>
    </Card>
  )
}
