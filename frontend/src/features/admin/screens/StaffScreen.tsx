'use client';

/**
 * School staff administration: create teachers/school-admins, deactivate and
 * reactivate accounts, request password resets. Tenant-scoped by the backend;
 * the institution comes from the session and users never choose a platform role.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Field, LoadingState, PageHeader, Select, TextInput } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { getErrorMessage } from '@/lib/api';
import { adminApi, adminKeys, type StaffMember } from '../api';

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Teacher',
  SCHOOL_ADMIN: 'School Admin',
  GUARDIAN: 'Guardian',
};

type Message = { tone: 'success' | 'error'; text: string } | null;

export default function StaffScreen() {
  const { user, loading: authLoading } = useAuth();
  const institutionId = user?.institutionId;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<Message>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('TEACHER');

  const staff = useQuery({
    queryKey: adminKeys.staff(institutionId ?? 0),
    queryFn: () => adminApi.staff(institutionId!),
    enabled: institutionId != null,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.staff(institutionId!) });
  const onError = (fallback: string) => (err: unknown) =>
    setMessage({ tone: 'error', text: getErrorMessage(err, fallback) });

  const create = useMutation({
    mutationFn: () => adminApi.createStaff(institutionId!, { email: email.trim(), name: name.trim(), role }),
    onSuccess: async (res) => {
      // The backend returns the single-use setup password once, in this response.
      setMessage({
        tone: 'success',
        text: res?.tempPassword
          ? `Account created for ${name.trim()} (${email.trim()}). One-time password: ${res.tempPassword} — share it now; they change it after first sign-in.`
          : `Account created for ${name.trim()}. They will receive a one-time password by email.`,
      });
      setEmail('');
      setName('');
      await refresh();
    },
    onError: onError('Could not create the account. Please try again.'),
  });

  const setActive = useMutation({
    mutationFn: ({ row, active }: { row: StaffMember; active: boolean }) =>
      adminApi.setStaffActive(institutionId!, row.id, active),
    onSuccess: async (_res, { row, active }) => {
      setMessage({
        tone: 'success',
        text: active ? `${row.name} can sign in again.` : `${row.name} can no longer sign in.`,
      });
      await refresh();
    },
    onError: onError('Could not update the account.'),
  });

  const requestReset = useMutation({
    mutationFn: (row: StaffMember) => adminApi.requestStaffReset(institutionId!, row.id),
    onSuccess: (_res, row) => setMessage({ tone: 'success', text: `Password reset notice sent to ${row.email}.` }),
    onError: onError('Could not send the reset notice.'),
  });

  // While the session is still resolving, show a loading state — never the
  // "not linked" error, which is only true once the session has loaded.
  if (authLoading) return <LoadingState label="Loading your school…" />;
  if (institutionId == null) {
    return (
      <Alert tone="error" className="mx-auto mt-10 max-w-md">
        Your account is not linked to a school, so staff management is not available.
      </Alert>
    );
  }

  const rows = staff.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Staff Accounts"
        description="Create teacher and school-admin accounts, and manage who can sign in."
      />

      <Card padding="lg" title="Add a staff account">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            create.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
          data-testid="create-staff-form"
        >
          <Field id="staff-name" label="Full name">
            <TextInput
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Grace Wanjiru"
            />
          </Field>
          <Field id="staff-email" label="School email">
            <TextInput
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="teacher@school.ac.ke"
            />
          </Field>
          <Field id="staff-role" label="Role">
            <Select id="staff-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="TEACHER">Teacher</option>
              <option value="SCHOOL_ADMIN">School Admin</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={create.isPending}
              data-testid="create-staff-submit"
            >
              {create.isPending ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-purple-300/70">
          The new staff member receives a one-time password and should change it at first sign-in.
        </p>
      </Card>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Card padding="lg" title="Current accounts">
        {staff.isError && <Alert tone="error">Could not load staff. Please refresh to try again.</Alert>}
        {staff.isLoading ? (
          <LoadingState label="Loading staff…" />
        ) : rows.length === 0 ? (
          <p className="text-purple-300">No staff accounts yet. Add your first teacher above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-purple-200">
              <thead>
                <tr className="border-b border-purple-300/20 text-left">
                  {['Name', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
                    <th key={h} scope="col" className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-purple-300/10" data-testid={`staff-row-${row.email}`}>
                    <td className="p-2">{row.name}</td>
                    <td className="break-all p-2">{row.email}</td>
                    <td className="p-2">{ROLE_LABELS[row.role] ?? row.role}</td>
                    <td className="p-2">
                      <span className={row.active ? 'text-purple-200' : 'text-fg-subtle'}>
                        {row.active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="space-x-3 whitespace-nowrap p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(null);
                          setActive.mutate({ row, active: !row.active });
                        }}
                        className="text-purple-300 underline hover:text-white"
                        data-testid={`staff-toggle-${row.email}`}
                      >
                        {row.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(null);
                          requestReset.mutate(row);
                        }}
                        className="text-purple-300 underline hover:text-white"
                      >
                        Send reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
