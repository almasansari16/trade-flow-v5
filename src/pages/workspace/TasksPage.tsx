import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useTasks, type Task } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/utils/cn'
import { relative } from '@/utils/format'

export default function TasksPage() {
  const tasks = useTasks()
  const categories = [...new Set(tasks.map((t) => t.category))]
  const [cat, setCat] = useState<string>('all')
  const rows = tasks.filter((t) => cat === 'all' || t.category === cat)
  const pr = (t: Task) => ({ high: 'bg-danger', medium: 'bg-warning', low: 'bg-slate-300' })[t.priority]

  return (
    <>
      <PageHeader title="My tasks" description="Everything currently waiting on you, generated from live workflow state." breadcrumbs={[{ label: 'Workspace' }, { label: 'My Tasks' }]} />
      <Card>
        <Tabs className="px-3" value={cat} onChange={setCat} items={[{ key: 'all', label: 'All', count: tasks.length }, ...categories.map((c) => ({ key: c, label: c, count: tasks.filter((t) => t.category === c).length }))]} />
        {rows.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="size-5" />} title="You’re all caught up" description="Tasks appear automatically when work reaches your role." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => (
              <li key={t.id}>
                <Link to={t.link} className="group flex items-center gap-4 px-5 py-4 hover:bg-canvas">
                  <span className={cn('size-2.5 shrink-0 rounded-full', pr(t))} aria-label={`${t.priority} priority`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{t.title}</span>
                    <span className="block truncate text-xs text-muted">{t.description}</span>
                  </span>
                  <Badge tone="neutral" className="hidden sm:inline-flex">{t.category}</Badge>
                  {t.dueAt && <span className={cn('hidden w-28 text-right text-xs md:block', new Date(t.dueAt).getTime() < Date.now() ? 'font-medium text-danger-700' : 'text-muted')}>Due {relative(t.dueAt)}</span>}
                  <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
