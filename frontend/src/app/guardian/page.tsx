'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Child {
    learnerId: number
    firstName: string
    lastName: string
    sneType: string | null
    gradeLevel: string | null
    lessonsAssigned: number
    lessonsCompleted: number
    recentActivity: string
}

export default function GuardianDashboard() {
    const { data: children, isLoading } = useQuery({
        queryKey: ['guardian-children'],
        queryFn: () => api.get('/api/guardian/children').then(r => r.data),
    })

    if (isLoading) return <div className="p-8">Loading...</div>

    return (
        <main className="p-4 md:p-8 max-w-4xl mx-auto" aria-labelledby="guardian-heading">
            <h1 id="guardian-heading" className="text-2xl font-bold mb-6">My Children</h1>

            {(!children || children.length === 0) ? (
                <div className="text-center py-12 text-gray-500">
                    <p className="text-lg">No linked learners yet.</p>
                    <p className="text-sm mt-2">Your child's school will link your account. Contact the school administrator.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {children.map((child: Child) => (
                        <div key={child.learnerId} className="border rounded-lg p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-semibold">{child.firstName} {child.lastName}</h2>
                                {child.sneType && (
                                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                    {child.sneType}
                  </span>
                                )}
                            </div>

                            {child.gradeLevel && (
                                <p className="text-sm text-gray-600 mb-2">Grade: {child.gradeLevel}</p>
                            )}

                            {/* Progress bar */}
                            <div className="mb-2">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Progress</span>
                                    <span>{child.lessonsCompleted}/{child.lessonsAssigned} lessons</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-green-500 h-2 rounded-full transition-all"
                                        style={{
                                            width: child.lessonsAssigned > 0
                                                ? `${Math.round((child.lessonsCompleted / child.lessonsAssigned) * 100)}%`
                                                : '0%'
                                        }}
                                    />
                                </div>
                            </div>

                            <p className="text-sm text-gray-500">{child.recentActivity}</p>
                        </div>
                    ))}
                </div>
            )}
        </main>
    )
}