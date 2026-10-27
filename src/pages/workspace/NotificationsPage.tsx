import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Bell, BellOff, CheckCheck, CreditCard, GitBranch, Mail, Settings2, Truck, Users } from 'lucide-react'
import { useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/utils/cn'
import { dateTime, relative } from '@/utils/format'
import type { AppNotification } from '@/types/domain'

const ICONS: Record<AppNotification['kind'], typeof Bell> = { approval: GitBranch, finance: CreditCard, logistics: Truck, customer: Users, system: Settings2, email: Mail, application: BadgeCheck }

export default function NotificationsPage() {
  const scope = useScope()
  const { markNotificationRead, markAllNotificationsRead } = useStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const list = [...scope.notifications].sort((a, b) => b.at.localeCompare(a.at)).filter((n) => tab === 'all' || !n.read)
  const unread = scope.notifications.filter((n) => !n.read).length

  return (
    <>
      <PageHeader
        title="Notifications"
        description="In-app alerts addressed to you or your roles. Email delivery is not simulated."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Notifications' }]}
        actions={<Button variant="secondary" icon={<CheckCheck className="size-4" />} disabled={!unread} onClick={markAllNotificationsRead}>Mark all as read</Button>}
      />
      <Card>
        <Tabs className="px-3" value={tab} onChange={setTab} items={[{ key: 'all', label: 'All', count: scope.notifications.length }, { key: 'unread', label: 'Unread', count: unread }]} />
        {list.length === 0 ? (
          <EmptyState icon={<BellOff className="size-5" />} title={tab === 'unread' ? 'No unread notifications' : 'No notifications'} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((n) => {
              const Icon = ICONS[n.kind]
              return (
                <li key={n.id} className={cn('flex items-start gap-4 px-5 py-4', !n.read && 'bg-primary-50/30')}>
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', n.read ? 'bg-slate-100 text-muted' : 'bg-primary-50 text-primary')}><Icon className="size-4" /></span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { markNotificationRead(n.id); if (n.link) navigate(n.link) }}>
                    <span className={cn('block text-[13px]', n.read ? 'font-medium' : 'font-semibold')}>{n.title}</span>
                    <span className="block text-[13px] text-muted">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-muted" title={dateTime(n.at)}>{relative(n.at)}</span>
                  </button>
                  <button type="button" onClick={() => markNotificationRead(n.id, !n.read)} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-canvas hover:text-ink">
                    {n.read ? 'Mark unread' : 'Mark read'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
