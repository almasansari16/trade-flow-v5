import { FileText, FlaskConical } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { fileSize } from '@/utils/format'

/**
 * Placeholder preview for documents. The prototype never stores file content,
 * so this renders a stylised page instead of the real file.
 */
export function DocumentPreview({ doc, onClose }: { doc: { name: string; type: string; sizeKb: number } | null; onClose: () => void }) {
  const toast = useToast()
  return (
    <Dialog
      open={!!doc}
      onClose={onClose}
      title={doc?.name ?? ''}
      description={doc ? `${doc.type} · ${fileSize(doc.sizeKb)}` : undefined}
      size="lg"
      footer={
        <>
          <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-muted"><FlaskConical className="size-3.5" /> Placeholder preview — file content is not stored in the prototype.</span>
          <Button variant="secondary" onClick={() => toast.info('Download simulated', 'No file is produced in the prototype.')}>Download</Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="mx-auto aspect-[1/1.3] max-w-md rounded-lg border border-line bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <FileText className="size-8 text-primary" />
          <div className="text-right">
            <div className="ml-auto h-2.5 w-28 rounded bg-slate-200" />
            <div className="ml-auto mt-1.5 h-2 w-20 rounded bg-slate-100" />
          </div>
        </div>
        <p className="mt-8 text-center text-sm font-semibold uppercase tracking-widest text-ink/70">{doc?.type}</p>
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-2 rounded bg-slate-100" style={{ width: `${92 - ((i * 17) % 35)}%` }} />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="h-14 rounded border border-dashed border-line" />
          <div className="h-14 rounded border border-dashed border-line" />
        </div>
        <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-wider text-primary/70">Demo document</p>
      </div>
    </Dialog>
  )
}
