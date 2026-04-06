import React from 'react'
import Link from 'next/link'
import { Document } from '@/types'

interface Props {
  document: Document
  calmUI?: boolean
}

const DocumentCard: React.FC<Props> = ({ document, calmUI }) => {
  const actionColorMap: Record<string, string> = {
    Simplified: 'bg-sky-100 text-sky-800 border-sky-200',
    'Q&A': 'bg-violet-100 text-violet-800 border-violet-200',
    ReadAloud: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  }

  return (
    <Link href={`/document/${document.id}`} className="group block h-full">
      <div
        className={`h-full rounded-2xl border p-5 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg ${
          calmUI
            ? 'border-gray-300 bg-white'
            : 'border-slate-200 bg-gradient-to-br from-white to-slate-50'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {document.fileType ?? 'Document'}
          </p>
          <p className="text-xs font-medium text-slate-500">{document.uploadedAt}</p>
        </div>

        <h2 className="line-clamp-2 text-xl font-bold text-slate-900">{document.title}</h2>

        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
          {document.summary ?? 'Tap to open this document and continue your learning flow.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {document.actions?.map((action, i) => (
            <span
              key={i}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                actionColorMap[action] ?? 'border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              {action}
            </span>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              document.status === 'In Review'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {document.status ?? 'Processed'}
          </span>
          <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
            Open document
          </span>
        </div>
      </div>
    </Link>
  )
}

export default DocumentCard
