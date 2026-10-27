import type { ReactNode } from 'react'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/misc'
import { AccountPicker } from '@/components/sap/SapParts'
import { useAccountSelection } from '@/hooks/useSap'

/** Frame for customer-account reports: customers see their own account; staff choose one in their scope. */
export function AccountReport({ title, description, crumb, children }: { title: string; description: string; crumb: string; children: (customerId: string) => ReactNode }) {
  const acc = useAccountSelection()
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: 'Finance' }, { label: crumb }]}
        actions={!acc.external && acc.options.length > 0 && <AccountPicker customerId={acc.customerId} options={acc.options} onPick={acc.pick} />}
      />
      {acc.customerId ? children(acc.customerId) : <div className="card"><EmptyState icon={<Users className="size-5" />} title="No customer account in scope" /></div>}
    </>
  )
}
