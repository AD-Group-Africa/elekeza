'use client';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-white to-indigo-500 p-6" role="main" aria-label="Dashboard">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-900 mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-lg text-blue-900">Recent Lessons</h2>
            <p className="text-gray-600 mt-2">The Water Cycle – Completed</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-lg text-blue-900">Quiz History</h2>
            <p className="text-gray-600 mt-2">Water Cycle Quiz – 80%</p>
          </div>
        </div>
      </div>
    </main>
  );
}
