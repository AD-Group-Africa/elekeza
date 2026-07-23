export default function DashboardSkeleton({ title }: { title: string }) {
  return (
    <div className="min-h-screen p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-8"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-800 rounded-xl"></div>
          <div className="h-64 bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}

