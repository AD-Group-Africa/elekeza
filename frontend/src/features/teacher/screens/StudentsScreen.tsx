'use client';

import { Fragment, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HeartHandshake, Plus, Search, User } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  TextInput,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { teacherApi, teacherKeys, useStudents, type NewStudent } from '../api';
import { StudentSupportPanel } from '../components/StudentSupportPanel';
import { LearnerRecord } from '@/features/learners/components/LearnerRecord';

const SNE_LABEL: Record<string, string> = {
  NONE: 'None',
  DYSLEXIA: 'Dyslexia',
  ADHD: 'ADHD',
  AUTISM: 'Autism',
  INTELLECTUAL: 'Intellectual disability',
};

const EMPTY_STUDENT: NewStudent = { email: '', fullName: '', password: '', sneType: 'NONE' };

export default function StudentsScreen() {
  const queryClient = useQueryClient();
  const students = useStudents();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewStudent>(EMPTY_STUDENT);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const addStudent = useMutation({
    mutationFn: teacherApi.createStudent,
    onSuccess: async () => {
      setForm(EMPTY_STUDENT);
      setShowForm(false);
      setMessage({ tone: 'success', text: 'Student added successfully!' });
      await queryClient.invalidateQueries({ queryKey: teacherKeys.students });
    },
    onError: (err) => setMessage({ tone: 'error', text: getErrorMessage(err, 'Failed to add student.') }),
  });

  const filtered = (students.data ?? []).filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Management"
        actions={
          <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setShowForm((s) => !s)}>
            Add Student
          </Button>
        }
      />

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {showForm && (
        <Card padding="lg" title="Add New Student">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(null);
              addStudent.mutate(form);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field id="new-student-name" label="Full name">
              <TextInput
                id="new-student-name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </Field>
            <Field id="new-student-email" label="Email">
              <TextInput
                id="new-student-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </Field>
            <Field
              id="new-student-password"
              label="Temporary password"
              hint="Share it with the learner; they can change it later."
            >
              <TextInput
                id="new-student-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
            </Field>
            <Field id="new-student-sne" label="Special needs (SNE)">
              <Select
                id="new-student-sne"
                value={form.sneType}
                onChange={(e) => setForm({ ...form, sneType: e.target.value })}
              >
                <option value="NONE">No SNE</option>
                <option value="DYSLEXIA">Dyslexia</option>
                <option value="ADHD">ADHD</option>
                <option value="AUTISM">Autism</option>
                <option value="INTELLECTUAL">Intellectual Disability</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={addStudent.isPending}>
                {addStudent.isPending ? 'Adding…' : 'Add'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="relative mb-4">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300" aria-hidden="true" />
          <TextInput
            type="search"
            aria-label="Search students"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {students.isError && <Alert tone="error">Could not load students. Please refresh to try again.</Alert>}
        {students.isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent"
            icon={<User size={48} />}
            title="No students found."
            action={<Button onClick={() => setShowForm(true)}>Add Student</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-purple-200">
              <thead className="text-sm text-purple-300">
                <tr>
                  <th scope="col" className="py-2 text-left">
                    Name
                  </th>
                  <th scope="col" className="py-2 text-left">
                    Email
                  </th>
                  <th scope="col" className="py-2 text-left">
                    SNE Type
                  </th>
                  <th scope="col" className="py-2 text-left">
                    Learning support
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const isOpen = expanded === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr className="border-t border-purple-300/10 align-top">
                        <td className="py-3">{s.name}</td>
                        <td className="py-3 text-purple-300">{s.email}</td>
                        <td className="py-3">
                          <Badge tone="accent">{SNE_LABEL[s.sneType || 'NONE'] ?? s.sneType}</Badge>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : s.id)}
                            aria-expanded={isOpen}
                            className="flex items-center gap-2 rounded-lg border border-purple-300/20 bg-white/5 px-3 py-1.5 text-sm text-purple-200 hover:bg-white/10"
                          >
                            <HeartHandshake size={15} aria-hidden="true" /> {isOpen ? 'Hide support' : 'View support'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-purple-300/10">
                          <td colSpan={4} className="py-3 pl-4">
                            <div className="space-y-6">
                              <StudentSupportPanel studentId={s.id} />
                              <div className="border-t border-purple-300/10 pt-4">
                                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-300">
                                  School record
                                </h3>
                                <LearnerRecord learnerId={s.id} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
