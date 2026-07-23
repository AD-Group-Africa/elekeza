import { ReactNode } from 'react'

export function RoleHero({ title, description }: { title: string; description: string }) {
  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-md">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-200">{description}</p>
    </section>
  )
}

export function StatGrid({ stats }: { stats: Array<{ label: string; value: string }> }) {
  return (
    <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.label} className="rounded-xl border border-slate-200 glass-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">{stat.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
        </article>
      ))}
    </section>
  )
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 glass-card p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}


