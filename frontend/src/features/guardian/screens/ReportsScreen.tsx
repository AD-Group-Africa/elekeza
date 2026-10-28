'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { ButtonLink, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { downloadTextFile } from '@/lib/download';
import { guardianApi, guardianKeys, type WardReport } from '../api';

function downloadReport(r: WardReport) {
  const content = [
    'Elekeza Progress Report',
    `Learner: ${r.wardName ?? r.title}`,
    `Date: ${r.date}`,
    `Lessons completed: ${r.lessonsCompleted ?? 0}`,
    `Lessons still to do: ${r.lessonsPending ?? 0}`,
    `Average quiz score: ${Math.round(r.averageScore ?? 0)}%`,
  ].join('\n');
  const safeName = (r.wardName ?? 'learner').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadTextFile(`elekeza-report-${safeName}-${r.date}.txt`, content);
}

export default function ReportsScreen() {
  const { data: reports = [], isLoading } = useQuery({ queryKey: guardianKeys.reports, queryFn: guardianApi.reports });

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" />
      {isLoading ? (
        <LoadingState />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<FileText size={48} />}
          title="No reports available yet."
          action={<ButtonLink href="/guardian/communication">Contact Teacher</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-purple-200">{r.title}</h2>
                  <p className="text-sm text-purple-300">
                    {r.date} · {r.lessonsCompleted ?? 0} lessons completed · average {Math.round(r.averageScore ?? 0)}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadReport(r)}
                  aria-label={`Download ${r.title}`}
                  className="flex items-center gap-1 text-purple-300 hover:text-white"
                >
                  <Download size={18} aria-hidden="true" /> Download
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
