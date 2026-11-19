'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, FileUp } from 'lucide-react';
import { Alert, Button, ButtonLink, Card, PageHeader } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { getErrorMessage } from '@/lib/api';
import { roleHome } from '@/lib/roles';
import { cn } from '@/lib/cn';
import { adminApi, type ImportResult } from '../api';

const TEMPLATE_CSV = [
  'firstName,lastName,grade,sneType,guardianEmail,guardianPhone,guardianName,guardianRelationship',
  'Amina,Ali,Grade 4,DYSLEXIA,fatuma@example.com,+254712345678,Fatuma Ali,Mother',
  'Juma,Osei,Grade 3,NONE,,,,',
  'Baraka,Kamau,Grade 5,ADHD,james@example.com,+254723456789,James Kamau,Father',
].join('\n');

const COLUMNS: Array<[string, boolean, string]> = [
  ['firstName', true, 'Any'],
  ['lastName', true, 'Any'],
  ['grade', false, 'Grade 1–12, PP1, PP2'],
  ['sneType', false, 'DYSLEXIA | ADHD | AUTISM | INTELLECTUAL_DISABILITY | NONE'],
  ['guardianEmail', false, 'Parent email — for progress notifications'],
  ['guardianPhone', false, 'E.g. +254712345678'],
  ['guardianName', false, 'Full name of parent/guardian'],
  ['guardianRelationship', false, 'Mother | Father | Guardian | Sibling'],
];

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'elekeza_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Bulk learner (and guardian) account creation from a CSV file. */
export default function StudentImportScreen() {
  const { user } = useAuth();
  const institutionId = user?.institutionId;
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const importCsv = useMutation({ mutationFn: (csv: File) => adminApi.importStudents(institutionId!, csv) });
  const result: ImportResult | undefined = importCsv.data;

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setFileError('Only .csv files are supported');
      return;
    }
    setFile(f);
    setFileError('');
  };

  const reset = () => {
    setFile(null);
    importCsv.reset();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {institutionId == null && (
        <Alert tone="warning">
          <p className="font-semibold">Your account is not linked to a school.</p>
          <p className="mt-1">
            Student imports belong to a school. Sign in with a school admin account to import students.
          </p>
        </Alert>
      )}
      <PageHeader title="Import Students" description="Add multiple learners at once from a spreadsheet" />

      <Card className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-purple-100">Download CSV template</h2>
          <p className="mt-0.5 text-sm text-purple-300">
            Fill it in and upload below. Only firstName &amp; lastName are required.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={16} aria-hidden="true" />}
          onClick={downloadTemplate}
        >
          Template
        </Button>
      </Card>

      <Card title="Column guide">
        <div className="overflow-x-auto text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-purple-300/20 text-left text-purple-200">
                <th scope="col" className="pb-2 pr-6 font-medium">
                  Column
                </th>
                <th scope="col" className="pb-2 pr-6 font-medium">
                  Required
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Values
                </th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map(([col, required, values]) => (
                <tr key={col} className="border-b border-purple-300/10 last:border-0">
                  <td className="py-2 pr-6 font-mono text-xs text-purple-200">{col}</td>
                  <td className="py-2 pr-6 text-center font-bold text-green-400">
                    {required ? <span aria-label="required">✓</span> : <span className="sr-only">optional</span>}
                  </td>
                  <td className="py-2 text-xs text-purple-300">{values}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!result && (
        <>
          <label
            htmlFor="csv-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              'glass-card block cursor-pointer border-2 border-dashed p-8 text-center transition-all focus-within:ring-2 focus-within:ring-purple-400',
              dragOver ? 'border-purple-400 bg-purple-500/10' : 'border-purple-300/30 hover:border-purple-300',
            )}
          >
            <input
              id="csv-file"
              ref={inputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <FileUp size={40} className="mx-auto mb-3 text-purple-300" aria-hidden="true" />
            {file ? (
              <p className="font-semibold text-purple-100">{file.name}</p>
            ) : (
              <>
                <p className="font-medium text-purple-200">Drop your CSV here, or click to browse</p>
                <p className="mt-1 text-sm text-purple-300">.csv files only</p>
              </>
            )}
          </label>
          {fileError && <Alert tone="error">{fileError}</Alert>}
          {importCsv.isError && (
            <Alert tone="error">
              {getErrorMessage(importCsv.error, 'Import failed — check your CSV format and try again.')}
            </Alert>
          )}
          {file && (
            <Button
              size="lg"
              className="w-full"
              onClick={() => importCsv.mutate(file)}
              loading={importCsv.isPending}
              disabled={institutionId == null}
            >
              {importCsv.isPending ? 'Importing…' : `Import ${file.name}`}
            </Button>
          )}
        </>
      )}

      {result && (
        <Card padding="lg" className="space-y-5">
          {result.studentCredentials && result.studentCredentials.length > 0 && (
            <CredentialList
              title="Learner logins created"
              rows={result.studentCredentials.map((s) => ({ key: s.email, email: s.email, password: s.tempPassword }))}
            />
          )}
          {result.guardianCredentials && result.guardianCredentials.length > 0 && (
            <CredentialList
              title="Guardian logins created"
              rows={result.guardianCredentials.map((g) => ({
                key: g.email + g.studentEmail,
                email: g.email,
                password: g.tempPassword,
                note: `${g.relationship.toLowerCase().replace(/_/g, ' ')} of ${g.studentEmail}`,
              }))}
            />
          )}

          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden="true">
              {result.failedRows === 0 ? '✅' : '⚠️'}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-purple-100">Import complete</h2>
              <p className="text-sm text-purple-300">
                {result.succeededRows} students added · {result.failedRows} failed
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {(
              [
                ['Total', result.totalRows, 'text-blue-400'],
                ['Added', result.succeededRows, 'text-green-400'],
                ['Failed', result.failedRows, 'text-red-400'],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="rounded-xl bg-white/5 py-4 text-center">
                <dd className={`text-2xl font-bold ${tone}`}>{value}</dd>
                <dt className="mt-1 text-xs text-purple-200">{label}</dt>
              </div>
            ))}
          </dl>
          {result.errors.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200">Row errors</h3>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {result.errors.map((e) => (
                  <li
                    key={e.row}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                  >
                    <span className="font-mono">Row {e.row}:</span> {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={reset}>
              Import more
            </Button>
            <ButtonLink href={roleHome(user?.role)} className="flex-1">
              Go to dashboard
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}

function CredentialList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; email: string; password: string; note?: string }>;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
      <h2 className="mb-1 font-semibold text-emerald-100">{title}</h2>
      <p className="mb-3 text-xs text-emerald-200">
        Share these one-time credentials now. They can change their password after signing in.
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-black/20 px-3 py-2 text-sm">
            <span className="font-medium text-white">{r.email}</span>
            <span className="font-mono text-emerald-200">temp password: {r.password}</span>
            {r.note && <span className="text-xs text-purple-300">{r.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
