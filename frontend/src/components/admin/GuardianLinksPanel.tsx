'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';

/**
 * School-side guardian link lifecycle panel. Shows who is linked to a learner,
 * lets the school revoke (temporary caregivers, separated families) or restore
 * access, and grant temporary (auto-expiring) caregiving links.
 */

interface LinkRow {
  id: number;
  guardianId: number;
  guardianEmail: string;
  learnerId: number;
  learnerName: string;
  relationship: string;
  active: boolean;
  revoked: boolean;
  expiresAt: string | null;
}

export default function GuardianLinksPanel({ learnerId }: { learnerId: number | string }) {
  const { user } = useAuth();
  const institutionId = user?.institutionId;
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await api.get<LinkRow[]>(`/institutions/${institutionId}/learners/${learnerId}/guardian-links`);
      setLinks(res.data);
      setError('');
    } catch {
      setError('Could not load guardian links.');
    } finally {
      setLoading(false);
    }
  }, [institutionId, learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, okMessage: string) => {
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(okMessage);
      await load();
    } catch (err) {
      const payload = err as { response?: { data?: { message?: string } } };
      setError(payload?.response?.data?.message ?? 'The change could not be saved.');
    }
  };

  const base = institutionId ? `/institutions/${institutionId}/learners/${learnerId}/guardian-links` : null;
  if (!base) return null;

  return (
    <section className="glass-card p-6 mt-6" aria-labelledby="guardian-links-heading">
      <h2 id="guardian-links-heading" className="text-lg font-semibold text-purple-200 mb-2">
        Guardians &amp; caregivers
      </h2>
      <p className="text-purple-300 text-sm mb-4">
        Who can see this learner&apos;s information. A revoked or expired link immediately stops granting access.
      </p>

      {error && <p className="text-red-400 text-sm mb-2" role="alert">{error}</p>}
      {notice && <p className="text-purple-200 text-sm mb-2" role="status">{notice}</p>}

      {loading ? (
        <p className="text-purple-300 animate-pulse" role="status">Loading links…</p>
      ) : links.length === 0 ? (
        <p className="text-purple-300">No guardian is linked to this learner yet.</p>
      ) : (
        <ul className="space-y-3">
          {links.map((link) => (
            <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/10 pb-3">
              <div>
                <p className="text-purple-200">
                  {link.learnerName} · {link.guardianEmail}
                </p>
                <p className="text-purple-400 text-xs">
                  {link.relationship.toLowerCase()}
                  {link.revoked ? ' · revoked' : link.active ? ' · active' : ' · expired'}
                  {link.expiresAt ? ` · expires ${new Date(link.expiresAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="space-x-3 whitespace-nowrap">
                {link.revoked ? (
                  <button
                    type="button"
                    onClick={() => act(() => api.post(`${base}/${link.guardianId}/restore`), 'Guardian access restored.')}
                    className="underline text-purple-300 hover:text-white"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => act(() => api.post(`${base}/${link.guardianId}/revoke`), 'Guardian access revoked.')}
                    className="underline text-purple-300 hover:text-white"
                  >
                    Revoke
                  </button>
                )}
                {!link.revoked && !link.expiresAt && (
                  <button
                    type="button"
                    onClick={() => {
                      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                      act(
                        () => api.post(`${base}/${link.guardianId}/temporary?expiresAt=${expiry}`),
                        'Link set to expire in 30 days.'
                      );
                    }}
                    className="underline text-purple-300 hover:text-white"
                  >
                    Make temporary (30 days)
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
