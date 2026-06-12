'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Student {
    userId: number
    firstName: string
    lastName: string
    sneType: string | null
    gradeLevel: string | null
    lessonsCompleted: number
    lessonsAssigned: number
    averageScore: number | null
}

interface Lesson {
    id: number
    title: string
    status: string
}

export default function TeacherDashboard() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [selectedStudents, setSelectedStudents] = useState<number[]>([])
    const [selectedLesson, setSelectedLesson] = useState<number | null>(null)

    const { data: students, isLoading } = useQuery({
        queryKey: ['teacher-students'],
        queryFn: () => api.get('/api/teacher/students').then(r => r.data),
    })

    const { data: lessons } = useQuery({
        queryKey: ['available-lessons'],
        queryFn: () => api.get('/api/content/list').then(r => r.data),
        enabled: showAssignModal,
    })

    const assignMutation = useMutation({
        mutationFn: (data: { contentId: number; studentIds: number[] }) =>
            api.post('/api/teacher/content/assign', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacher-students'] })
            setShowAssignModal(false)
            setSelectedStudents([])
            setSelectedLesson(null)
        },
    })

    const toggleStudent = (id: number) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        )
    }

    const handleAssign = () => {
        if (selectedLesson && selectedStudents.length > 0) {
            assignMutation.mutate({ contentId: selectedLesson, studentIds: selectedStudents })
        }
    }

    if (isLoading) return <div className="p-8">Loading students...</div>

    return (
        <main className="p-4 md:p-8 max-w-6xl mx-auto" aria-labelledby="teacher-heading">
            <div className="flex items-center justify-between mb-6">
                <h1 id="teacher-heading" className="text-2xl font-bold">My Students</h1>
                <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:ring-2 focus:ring-offset-2"
                >
                    Assign Lesson
                </button>
            </div>

            {/* Student table */}
            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left" aria-label="Student list">
                    <thead className="bg-gray-50 text-gray-700">
                    <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">SNE Type</th>
                        <th className="px-4 py-3">Grade</th>
                        <th className="px-4 py-3">Completed</th>
                        <th className="px-4 py-3">Assigned</th>
                    </tr>
                    </thead>
                    <tbody>
                    {students?.map((s: Student) => (
                        <tr key={s.userId} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{s.firstName} {s.lastName}</td>
                            <td className="px-4 py-3">
                                {s.sneType ? (
                                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                      {s.sneType}
                    </span>
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </td>
                            <td className="px-4 py-3">{s.gradeLevel || '—'}</td>
                            <td className="px-4 py-3">{s.lessonsCompleted}</td>
                            <td className="px-4 py-3">{s.lessonsAssigned}</td>
                        </tr>
                    ))}
                    {(!students || students.length === 0) && (
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                No students yet. Import students via the Admin dashboard.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Assign Lesson Modal */}
            {showAssignModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Assign lesson to students"
                >
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <h2 className="text-lg font-bold mb-4">Assign Lesson</h2>

                        {/* Lesson selector */}
                        <label className="block mb-4">
                            <span className="text-sm font-medium">Select Lesson</span>
                            <select
                                value={selectedLesson || ''}
                                onChange={(e) => setSelectedLesson(Number(e.target.value))}
                                className="mt-1 block w-full border rounded-md p-2 text-sm"
                            >
                                <option value="" disabled>Choose a lesson...</option>
                                {lessons?.map((l: Lesson) => (
                                    <option key={l.id} value={l.id}>{l.title}</option>
                                ))}
                            </select>
                        </label>

                        {/* Student selector */}
                        <fieldset className="mb-4">
                            <legend className="text-sm font-medium mb-2">Select Students</legend>
                            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                                {students?.map((s: Student) => (
                                    <label key={s.userId} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedStudents.includes(s.userId)}
                                            onChange={() => toggleStudent(s.userId)}
                                            className="rounded"
                                        />
                                        <span className="text-sm">{s.firstName} {s.lastName}</span>
                                        {s.sneType && (
                                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {s.sneType}
                      </span>
                                        )}
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{selectedStudents.length} selected</p>
                        </fieldset>

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="px-4 py-2 border rounded-md text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={!selectedLesson || selectedStudents.length === 0 || assignMutation.isPending}
                                className="px-4 py-2 bg-primary text-white rounded-md text-sm disabled:opacity-50"
                            >
                                {assignMutation.isPending ? 'Assigning...' : `Assign to ${selectedStudents.length} student(s)`}
                            </button>
                        </div>

                        {assignMutation.isSuccess && (
                            <p className="mt-2 text-sm text-green-600" role="status">Lesson assigned successfully!</p>
                        )}
                        {assignMutation.isError && (
                            <p className="mt-2 text-sm text-red-600" role="alert">Failed to assign lesson.</p>
                        )}
                    </div>
                </div>
            )}
        </main>
    )
}