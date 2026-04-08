'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DocumentCard from '@/components/DocumentCard'
import Sidebar from '@/components/Sidebar'
import AccessibilityToolbar from '@/components/AccessibilityToolbar'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { useAuth } from '@/hooks/useAuth'
import { Document } from '@/types'

const historyDocs: Document[] = [
  {
    id: '1',
    title: 'Project Proposal',
    uploadedAt: '2026-03-01',
    actions: ['Simplified', 'Q&A'],
    fileType: 'PDF',
    summary: 'Proposal text adapted for easier reading with guided follow-up questions.',
    status: 'Processed',
  },
  {
    id: '2',
    title: 'User Manual',
    uploadedAt: '2026-02-25',
    actions: ['ReadAloud'],
    fileType: 'DOCX',
    summary: 'Manual converted to speech-enabled format for auditory learning support.',
    status: 'Processed',
  },
  {
    id: '3',
    title: 'Research Notes',
    uploadedAt: '2026-02-20',
    actions: ['Simplified'],
    fileType: 'TXT',
    summary: 'Dense research notes transformed into concise point-by-point highlights.',
    status: 'Processed',
  },
  {
    id: '4',
    title: 'Chemistry Revision Pack',
    uploadedAt: '2026-01-15',
    actions: ['Q&A', 'ReadAloud'],
    fileType: 'PDF',
    summary: 'Revision pack now includes interactive comprehension checks and read-aloud.',
    status: 'In Review',
  },
]

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { settings, toggleSetting } = useAccessibilitySettings()
  const [searchText, setSearchText] = useState('')
  const [selectedAction, setSelectedAction] = useState('All')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const allActions = useMemo(() => {
    const actionSet = new Set<string>()
    historyDocs.forEach((doc) => doc.actions?.forEach((action) => actionSet.add(action)))
    return ['All', ...Array.from(actionSet)]
  }, [])

  const filteredDocs = useMemo(() => {
    const searchValue = searchText.trim().toLowerCase()

    const docs = historyDocs.filter((doc) => {
      const matchesSearch =
        !searchValue ||
        doc.title.toLowerCase().includes(searchValue) ||
        doc.summary?.toLowerCase().includes(searchValue) ||
        doc.fileType?.toLowerCase().includes(searchValue)

      const matchesAction =
        selectedAction === 'All' || doc.actions?.some((action) => action === selectedAction)

      return matchesSearch && matchesAction
    })

    return docs.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)

      const aTime = new Date(a.uploadedAt).getTime()
      const bTime = new Date(b.uploadedAt).getTime()

      return sortBy === 'newest' ? bTime - aTime : aTime - bTime
    })
  }, [searchText, selectedAction, sortBy])

  const latestUpload = useMemo(() => {
    if (historyDocs.length === 0) return 'N/A'
    const dates = historyDocs.map((doc) => new Date(doc.uploadedAt))
    const newest = new Date(Math.max(...dates.map((date) => date.getTime())))
    return newest.toLocaleDateString()
  }, [])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto mb-4"></div>
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-screen ${settings.calmUI ? 'bg-gray-100 text-gray-900' : 'bg-gray-50 text-gray-800'}`}>
      {/* Sidebar */}
      <Sidebar />

      <main className={`flex-1 overflow-y-auto p-6 ${settings.focusMode ? 'max-w-6xl mx-auto' : ''}`}>
        <AccessibilityToolbar
          calmUI={settings.calmUI}
          focusMode={settings.focusMode}
          onCalmToggle={() => toggleSetting('calmUI')}
          onFocusToggle={() => toggleSetting('focusMode')}
        />

        <section className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Your Learning Archive</p>
              <h1 className="mt-2 text-3xl font-bold">Document History</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Find previous uploads quickly, review actions you used, and reopen a file right where you left off.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => router.push('/upload')}
                className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200"
              >
                Upload New
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-xs text-cyan-100">Total Documents</p>
              <p className="mt-1 text-2xl font-bold">{historyDocs.length}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-xs text-cyan-100">Latest Upload</p>
              <p className="mt-1 text-2xl font-bold">{latestUpload}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-xs text-cyan-100">Available Actions</p>
              <p className="mt-1 text-2xl font-bold">{allActions.length - 1}</p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label htmlFor="history-search" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </label>
              <input
                id="history-search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by title, summary, or file type..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label htmlFor="history-sort" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sort By
              </label>
              <select
                id="history-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'title')}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {allActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => setSelectedAction(action)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selectedAction === action
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        </section>

        {filteredDocs.length > 0 ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-900">{filteredDocs.length}</span> document(s)
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {filteredDocs.map((doc) => (
                <DocumentCard key={doc.id} document={doc} calmUI={settings.calmUI} />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-16 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-gray-500">
            <p className="text-lg font-semibold text-slate-700">No documents match your current filters.</p>
            <p className="mt-2 text-sm text-slate-500">Try a different keyword or action tag, or upload a new file.</p>
            <button
              onClick={() => router.push('/upload')}
              className="mt-5 rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Upload Document
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
