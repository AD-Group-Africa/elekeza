'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';

/**
 * School staff administration: create teachers/school-admins, deactivate and
 * reactivate accounts, request password resets. Tenant-scoped by the backend;
 * this page reads institutionId from the session and never lets the user
 * choose a platform role.
 */

interface StaffRow {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
  phone?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Teacher',
  SCHOOL_ADMIN: 'School Admin',
  GUARDIAN: 'Guardian',
};

export default function StaffManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const institutionId = user?.institutionId;

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('TEACHER');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/institutions/${institutionId}/staff`);
      setStaff(res.data);
    } catch {
      setError('Could not load staff. Please refresh to try again.');
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionId) return;
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/institutions/${institutionId}/staff`, { email: email.trim(), name: name.trim(), role });
      // The backend returns the single-use setup password ONCE in the create
      // response (same credential-handover contract as the CSV import panel).
      const tempPassword = res.data?.tempPassword as string | undefined;
      setNotice(
        tempPassword
          ? `Account created for ${name.trim()} (${email.trim()}). One-time password: ${tempPassword} — share it now; they change it after first sign-in.`
          : `Account created for ${name.trim()}. They will receive a one-time password by email.`
      );
      setEmail('');
      setName('');
      await load();
    } catch (err) {
      const payload = err as { response?: { data?: { message?: string } } };
      setError(payload?.response?.data?.message ?? 'Could not create the account. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const setActive = async (row: StaffRow, active: boolean) => {
    if (!institutionId) return;
    setError('');
    setNotice('');
    try {
      await api.patch(`/institutions/${institutionId}/staff/${row.id}/active?active=${active}`);
      setNotice(active ? `${row.name} can sign in again.` : `${row.name} can no longer sign in.`);
      await load();
    } catch (err) {
      const payload = err as { response?: { data?: { message?: string } } };
      setError(payload?.response?.data?.message ?? 'Could not update the account.');
    }
  };

  const requestReset = async (row: StaffRow) => {
    if (!institutionId) return;
    setError('');
    setNotice('');
    try {
      await api.post(`/institutions/${institutionId}/staff/${row.id}/password-reset`);
      setNotice(`Password reset notice sent to ${row.email}.`);
    } catch (err) {
      const payload = err as { response?: { data?: { message?: string } } };
      setError(payload?.response?.data?.message ?? 'Could not send the reset notice.');
    }
  };

  // Audit EL-NEW-04: while the session is still resolving (auth/me in flight)
  // show a loading state — never the "not linked" error, which is only truthful
  // once the session has actually loaded without an institution.
  if (authLoading) {
    return (
      <main className="p-6">
        <div className="glass-card p-6 max-w-md mx-auto mt-10 text-center" aria-busy="true" aria-live="polite">
          <p className="text-purple-200">Loading your school…</p>
        </div>
      </main>
    );
  }

  if (!institutionId) {
    return (
      <main className="p-6">
        <div className="glass-card p-6 max-w-md mx-auto mt-10 text-center" role="alert">
          <p>Your account is not linked to a school, so staff management is not available.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-purple-200">Staff Accounts</h1>
        <p className="text-purple-300 text-sm mt-1">
          Create teacher and school-admin accounts, and manage who can sign in.
        </p>
      </header>

      <section className="glass-card p-6" aria-labelledby="create-staff-heading">
        <h2 id="create-staff-heading" className="text-lg font-semibold text-purple-200 mb-4">
          Add a staff account
        </h2>
        <form onSubmit={createStaff} className="grid gap-4 sm:grid-cols-2" data-testid="create-staff-form">
          <div>
            <label htmlFor="staff-name" className="block text-sm text-purple-300 mb-1">Full name</label>
            <input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. Grace Wanjiru"
            />
          </div>
          <div>
            <label htmlFor="staff-email" className="block text-sm text-purple-300 mb-1">School email</label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="teacher@school.ac.ke"
            />
          </div>
          <div>
            <label htmlFor="staff-role" className="block text-sm text-purple-300 mb-1">Role</label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="TEACHER">Teacher</option>
              <option value="SCHOOL_ADMIN">School Admin</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-60"
              data-testid="create-staff-submit"
            >
              {creating ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
        <p className="text-xs text-purple-300/70 mt-3">
          The new staff member receives a one-time password by email and should change it at first sign-in.
        </p>
      </section>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
      {notice && <p className="text-purple-200 text-sm" role="status">{notice}</p>}

      <section className="glass-card p-6" aria-labelledby="staff-list-heading">
        <h2 id="staff-list-heading" className="text-lg font-semibold text-purple-200 mb-4">Current accounts</h2>
        {loading ? (
          <p className="text-purple-300 animate-pulse" role="status">Loading staff…</p>
        ) : staff.length === 0 ? (
          <p className="text-purple-300">No staff accounts yet. Add your first teacher above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-purple-200">
              <thead>
                <tr className="border-b border-purple-300/20 text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((row) => (
                  <tr key={row.id} className="border-b border-purple-300/10" data-testid={`staff-row-${row.email}`}>
                    <td className="p-2">{row.name}</td>
                    <td className="p-2 break-all">{row.email}</td>
                    <td className="p-2">{ROLE_LABELS[row.role] ?? row.role}</td>
                    <td className="p-2">
                      <span className={row.active ? 'text-purple-200' : 'opacity-60'}>
                        {row.active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="p-2 space-x-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setActive(row, !row.active)}
                        className="underline text-purple-300 hover:text-white"
                        data-testid={`staff-toggle-${row.email}`}
                      >
                        {row.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestReset(row)}
                        className="underline text-purple-300 hover:text-white"
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
      </section>
    </main>
  );
}
