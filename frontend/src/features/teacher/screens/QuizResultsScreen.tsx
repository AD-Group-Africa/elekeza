'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { Alert, Card, LoadingState, PageHeader, Select } from '@/components/ui';
import { teacherApi, teacherKeys } from '../api';

/** Every answered quiz question, filterable by learner. */
export default function QuizResultsScreen() {
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: teacherKeys.quizResults, queryFn: teacherApi.quizResults });
  const [studentFilter, setStudentFilter] = useState('all');

  const students = [...new Set(rows.map((r) => r.studentName))].sort();
  const filtered = studentFilter === 'all' ? rows : rows.filter((r) => r.studentName === studentFilter);
  const correctCount = filtered.filter((r) => r.correct).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Per-Question Quiz Results"
        actions={
          <Select
            aria-label="Filter by student"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="w-auto"
          >
            <option value="all">All students</option>
            {students.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        }
      />

      {isError && <Alert tone="error">Could not load quiz results. Please refresh to try again.</Alert>}

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <Card padding="lg" className="text-center text-purple-300">
          No completed quiz answers yet. Results appear after learners complete quizzes.
        </Card>
      ) : (
        <>
          <Card className="flex items-center gap-2 text-sm text-purple-200">
            <span>{filtered.length} answers</span>
            <span className="text-purple-300" aria-hidden="true">
              ·
            </span>
            <span>
              {correctCount} correct ({Math.round((correctCount / filtered.length) * 100)}%)
            </span>
          </Card>
          <Card padding="none" className="overflow-x-auto" role="region" aria-label="Quiz results table" tabIndex={0}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-300/10 text-purple-300">
                  {['Student', 'Lesson', 'Question', 'Answer', 'Correct', 'Result'].map((h) => (
                    <th key={h} scope="col" className="p-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b border-purple-300/5 text-purple-200">
                    <td className="p-3">{r.studentName}</td>
                    <td className="p-3">{r.lessonTitle}</td>
                    <td className="max-w-xs p-3">{r.question}</td>
                    <td className="p-3 font-semibold">{r.userAnswer}</td>
                    <td className="p-3 text-purple-300">{r.correctAnswer}</td>
                    <td className="p-3">
                      {r.correct ? (
                        <Check size={18} className="text-green-400" aria-label="Correct" />
                      ) : (
                        <X size={18} className="text-red-400" aria-label="Incorrect" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
