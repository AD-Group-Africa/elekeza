'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export default function AdminDashboard() {
    const [file, setFile] = useState<File | null>(null)
    const [importResult, setImportResult] = useState<any>(null)

    const importMutation = useMutation({
        mutationFn: (formData: FormData) =>
            api.post('/api/institutions/1/students/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }),
        onSuccess: (res) => setImportResult(res.data),
    })

    const handleImport = () => {
        if (!file) return
        const fd = new FormData()
        fd.append('file', file)
        importMutation.mutate(fd)
    }

    return (
        <main className="p-4 md:p-8 max-w-4xl mx-auto" aria-labelledby="admin-heading">
            <h1 id="admin-heading" className="text-2xl font-bold mb-6">School Admin</h1>

            <section className="border rounded-lg p-6 mb-6" aria-labelledby="import-heading">
                <h2 id="import-heading" className="text-lg font-semibold mb-4">Import Students</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Upload a CSV file with columns: First Name, Last Name, Class Year, Age, SNE Type, Guardian Phone, Guardian Email.
                </p>

                <div className="flex items-center gap-4">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="text-sm border rounded p-2"
                    />
                    <button
                        onClick={handleImport}
                        disabled={!file || importMutation.isPending}
                        className="px-4 py-2 bg-primary text-white rounded-md text-sm disabled:opacity-50"
                    >
                        {importMutation.isPending ? 'Importing...' : 'Import'}
                    </button>
                </div>

                {importResult && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md" role="status">
                        <p className="font-medium">
                            Import complete: {importResult.succeeded} succeeded, {importResult.failed} failed (out of {importResult.total}).
                        </p>
                        {importResult.rows?.filter((r: any) => r.status === 'FAILED').length > 0 && (
                            <details className="mt-2">
                                <summary className="text-sm text-red-600 cursor-pointer">View errors</summary>
                                <ul className="mt-2 text-sm text-red-600 space-y-1">
                                    {importResult.rows.filter((r: any) => r.status === 'FAILED').map((r: any) => (
                                        <li key={r.row}>Row {r.row}: {r.error}</li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                )}
            </section>

            <section className="border rounded-lg p-6" aria-labelledby="links-heading">
                <h2 id="links-heading" className="text-lg font-semibold mb-4">Quick Links</h2>
                <div className="grid gap-2">
                    <a href="/teacher" className="text-primary hover:underline">Teacher Dashboard →</a>
                    <a href="/guardian" className="text-primary hover:underline">Guardian Dashboard →</a>
                    <a href="/admin/users" className="text-primary hover:underline">Manage Users →</a>
                </div>
            </section>
        </main>
    )
}