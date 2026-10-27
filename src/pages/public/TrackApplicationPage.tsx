import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, FlaskConical, Hash, LogIn, Mail, Search, ShieldCheck } from 'lucide-react'
import { useStore } from '@/app/store'
import { Logo } from '@/components/layout/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { TextField } from '@/components/forms/Field'
import { PublicStatusCard } from '@/components/applications/PublicStatusCard'
import { Skeleton } from '@/components/ui/misc'
import type { PublicApplicationView } from '@/workflow/publicView'
import { BRAND } from '@/config/brand'

/**
 * Public application tracking — no sign-in.
 * Requires reference + registered email, or a secure time-limited link (ref + token).
 */
export default function TrackApplicationPage() {
  const { tracking, isAuthenticated } = useStore()
  const [params, setParams] = useSearchParams()
  const [ref, setRef] = useState(params.get('ref') ?? '')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ ref?: string; email?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<PublicApplicationView | null>(null)
  const autoRan = useRef(false)

  // Secure link: /track?ref=APP-…&token=…
  useEffect(() => {
    const token = params.get('token')
    const r = params.get('ref')
    if (!token || !r || autoRan.current) return
    autoRan.current = true
    setBusy(true)
    tracking.trackByToken(r, token).then((res) => {
      setBusy(false)
      if (res.ok) setView(res.view)
      else setError(res.error)
    })
  }, [params, tracking])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!ref.trim()) errs.ref = 'Enter your application reference.'
    else if (!/^APP-\d{4}-\d{3,}$/i.test(ref.trim())) errs.ref = 'References look like APP-2026-0311.'
    if (!email.trim()) errs.email = 'Enter the email address used to register.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email address.'
    setErrors(errs)
    setError(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    const res = await tracking.trackByEmail(ref, email)
    setBusy(false)
    if (res.ok) setView(res.view)
    else setError(res.error)
  }

  const reset = () => {
    setView(null)
    setError(null)
    setEmail('')
    setParams({}, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-2">
            <ButtonLink to={isAuthenticated ? '/app' : '/login'} variant="secondary" size="sm" icon={<LogIn className="size-4" />}>{isAuthenticated ? 'Open portal' : 'Sign in'}</ButtonLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> Home</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Track your customer application</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">See the status, current stage and any action required — no sign-in needed. For your security we ask for the reference number <em>and</em> the email address used to register.</p>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-primary/40 bg-primary-50/70 px-3 py-2 text-xs text-primary-700">
          <FlaskConical className="mt-px size-4 shrink-0" />
          <span>Prototype: verification runs in your browser against demo data. In production this lookup must be performed and rate-limited by the server.</span>
        </div>

        {busy && !view && (
          <div className="mt-8 space-y-4" role="status" aria-label="Checking application">
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        )}

        {view ? (
          <div className="mt-8">
            <PublicStatusCard
              view={view}
              actions={
                <>
                  {view.actionRequired && view.actionRequired.type !== 'draft' && (
                    <ButtonLink to="/login" size="sm" icon={<LogIn className="size-4" />}>Sign in to respond</ButtonLink>
                  )}
                  {view.status === 'Approved' && <ButtonLink to="/login" size="sm" icon={<LogIn className="size-4" />}>Sign in to the portal</ButtonLink>}
                  <Button variant="secondary" size="sm" onClick={reset} icon={<Search className="size-4" />}>Track another application</Button>
                </>
              }
            />
          </div>
        ) : (
          !busy || !params.get('token') ? (
            <Card className="mt-8 max-w-xl">
              <CardBody>
                <form onSubmit={submit} noValidate className="space-y-4">
                  {error && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
                      <AlertCircle className="mt-px size-4 shrink-0" /> {error}
                    </div>
                  )}
                  <TextField label="Application reference" required value={ref} onChange={(e) => setRef(e.target.value)} error={errors.ref} placeholder="APP-2026-0311" leading={<Hash className="size-4" />} autoComplete="off" />
                  <TextField label="Registered email address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} placeholder="you@company.com" leading={<Mail className="size-4" />} autoComplete="email" />
                  <Button type="submit" loading={busy} icon={<Search className="size-4" />}>Check status</Button>
                </form>
                <div className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-xs text-muted">
                  <ShieldCheck className="mt-px size-4 shrink-0 text-success" />
                  <span>We only show the progress of your own application. Internal review notes and documents are never displayed here. You can also use the secure tracking link from your confirmation (valid for 30 days).</span>
                </div>
              </CardBody>
            </Card>
          ) : null
        )}
        <p className="mt-10 text-xs text-muted">{BRAND.demoNotice}</p>
      </main>
    </div>
  )
}
