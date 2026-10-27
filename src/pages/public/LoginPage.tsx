import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, Eye, EyeOff, FlaskConical, KeyRound, Lock, Mail, RotateCcw, Search } from 'lucide-react'
import { canFor, useStore } from '@/app/store'
import { Logo } from '@/components/layout/Logo'
import { Avatar } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/forms/Field'
import { useToast } from '@/components/ui/Toast'
import { BRAND } from '@/config/brand'
import { DEMO_ACCOUNTS } from '@/data/org'
import { DEMO_PASSWORD } from '@/auth/demoCredentials'
import { landingPathFor } from '@/config/navigation'

/** Only allow redirects inside the signed-in app (prevents open redirects). */
const safeNext = (next: string | null) => (next && next.startsWith('/app') && !next.startsWith('//') ? next : null)

export default function LoginPage() {
  const store = useStore()
  const { state, login, isAuthenticated, can, resetDemo } = store
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  if (isAuthenticated && !busy) return <Navigate to={next ?? landingPathFor(can)} replace />

  const submit = (e?: FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault()
    const em = (override?.email ?? email).trim()
    const pw = override?.password ?? password
    const errs: typeof errors = {}
    if (!em) errs.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(em)) errs.email = 'Enter a valid email address.'
    if (!pw) errs.password = 'Enter your password.'
    setErrors(errs)
    setFormError(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    // Small delay so the loading state is visible (a real IdP call is asynchronous).
    setTimeout(() => {
      const r = login(em, pw)
      if (!r.ok) {
        setBusy(false)
        setFormError(r.error)
        setPassword('')
        return
      }
      toast.success(`Welcome, ${r.user.name.split(' ')[0]}`)
      navigate(next ?? landingPathFor(canFor(state, r.user)), { replace: true })
      setBusy(false)
    }, 350)
  }

  const accounts = DEMO_ACCOUNTS.map((a) => ({ ...a, user: state.users.find((u) => u.id === a.userId) })).filter((a) => a.user)
  const others = state.users.filter((u) => u.active && u.id !== 'u-system' && !DEMO_ACCOUNTS.some((a) => a.userId === u.id))
  const signInAs = (em: string) => {
    setEmail(em)
    setPassword(DEMO_PASSWORD)
    submit(undefined, { email: em, password: DEMO_PASSWORD })
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[420px_1fr]">
      <aside className="hidden flex-col justify-between bg-midnight p-10 text-white lg:flex">
        <Link to="/"><Logo dark /></Link>
        <div>
          <p className="text-2xl font-semibold leading-snug tracking-tight">{BRAND.tagline}</p>
          <p className="mt-3 text-sm text-slate-400">Sign in to see the modules and records your role permits. Prospective customers can track an application without signing in.</p>
          <Link to="/track" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-indigo-200 hover:text-white">
            <Search className="size-4" /> Track an application
          </Link>
        </div>
        <p className="text-xs text-slate-500">{BRAND.demoNotice}</p>
      </aside>

      <main className="flex items-start justify-center bg-canvas px-5 py-12 lg:items-center">
        <div className="grid w-full max-w-5xl gap-8 xl:grid-cols-[minmax(0,400px)_1fr]">
          <div>
            <div className="mb-8 lg:hidden"><Link to="/"><Logo /></Link></div>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-[13px] text-muted">Use the email address registered for your account.</p>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-primary/40 bg-primary-50/70 px-3 py-2 text-xs text-primary-700">
              <FlaskConical className="mt-px size-4 shrink-0" />
              <span><strong>Prototype authentication.</strong> Credentials are checked in your browser against mock data. This is not a secure login — production requires a server-side identity provider.</span>
            </div>

            <form onSubmit={submit} noValidate className="mt-4 space-y-4" aria-describedby={formError ? 'login-error' : undefined}>
              {formError && (
                <div id="login-error" role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
                  <AlertCircle className="mt-px size-4 shrink-0" /> {formError}
                </div>
              )}
              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                leading={<Mail className="size-4" />}
                placeholder="name@company.com"
              />
              <TextField
                label="Password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                leading={<Lock className="size-4" />}
                trailing={
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
              <Button type="submit" className="w-full" loading={busy} iconRight={<ArrowRight className="size-4" />}>
                Sign in
              </Button>
              <p className="text-xs text-muted">Sessions expire after 8 hours of sign-in time. Forgotten passwords are reset by your administrator in this prototype.</p>
            </form>

            <div className="mt-8 space-y-2 text-[13px] text-muted">
              <p>New customer? <Link to="/register" className="font-medium text-primary hover:underline">Register your company</Link></p>
              <p>Already applied? <Link to="/track" className="font-medium text-primary hover:underline">Track your application</Link></p>
            </div>
          </div>

          <section aria-labelledby="demo-accounts" className="card self-start p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="demo-accounts" className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-primary" /> Five demo accounts</h2>
                <p className="mt-1 text-xs text-muted">
                  Prototype only — every seeded account uses the password <code className="rounded bg-canvas px-1 py-0.5 font-mono text-[11px] text-ink">{DEMO_PASSWORD}</code>. Choosing one fills the form and signs in.
                </p>
              </div>
              <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-canvas hover:text-ink">
                <RotateCcw className="size-3.5" /> Reset demo data
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {accounts.map(({ userId, label, description, user }) => (
                <li key={userId}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => signInAs(user!.email)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary-50/30 disabled:opacity-60"
                  >
                    <Avatar name={user!.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">{label} <span className="font-normal text-muted">· {user!.name}</span></span>
                      <span className="block truncate text-[11px] text-muted">{description}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted group-hover:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer font-medium text-muted hover:text-ink">More test accounts (other territories, prospective customers)</summary>
              <p className="mt-2 text-muted">These are additional records, not extra roles: other Account Managers show that each manager sees only their own territory, and prospective customers show the application flow. Same password.</p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {others.map((u) => (
                  <li key={u.id}>
                    <button type="button" disabled={busy} onClick={() => signInAs(u.email)} className="w-full truncate rounded px-2 py-1 text-left hover:bg-canvas">
                      <span className="font-medium text-ink">{u.name}</span> <span className="text-muted">· {u.title.split(',')[0]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </div>
      </main>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetDemo()
          setConfirmReset(false)
          toast.success('Demo data reset', 'All records, users and roles restored to their seeded state.')
        }}
        title="Reset demo data?"
        description="All changes made in this browser (applications, approvals, users, roles, settings) will be discarded."
        confirmLabel="Reset"
        tone="danger"
      />
    </div>
  )
}
