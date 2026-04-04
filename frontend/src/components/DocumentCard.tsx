import React from 'react'
import Link from 'next/link'
import { Document } from '@/types'

interface Props {
  document: Document
  calmUI?: boolean
}

const DocumentCard: React.FC<Props> = ({ document, calmUI }) => {
  return (
    <Link href={`/document/${document.id}`} className="block">
      <div
        className={`p-4 rounded-lg shadow ${calmUI ? 'bg-white border border-gray-300' : 'bg-blue-50 border border-blue-200'} hover:shadow-lg transition`}
      >
        <h2 className="text-xl font-semibold">{document.title}</h2>
        <p className="text-sm text-gray-500 mt-1">Uploaded: {document.uploadedAt}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {document.actions?.map((action, i) => (
            <span
              key={i}
              className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700"
            >
              {action}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

export default DocumentCard