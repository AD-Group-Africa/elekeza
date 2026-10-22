'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, LoadingState } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { adminApi, adminKeys, type GuardianLink } from '../api';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type LinkAction = { link: GuardianLink; kind: 'revoke' | 'restore' | 'temporary' };
const SUCCESS: Record<LinkAction['kind'], string> = {
  revoke: 'Guardian access revoked.',
  restore: 'Guardian access restored.',
  temporary: 'Link set to expire in 30 days.',
};

/**
 * School-side guardian link lifecycle. Shows who is linked to a learner and
 * lets the school revoke or restore access, or make a link temporary
 * (auto-expiring) for caregivers.
 */
export default function GuardianLinksPanel({ learnerId }: { learnerId: number | string }) {
  const queryClient = useQueryClient();
  const institutionId = useAuth().user?.institutionId;
  const [notice, setNotice] = useState('');

  const links = useQuery({
    queryKey: adminKeys.guardianLinks(institutionId ?? 0, learnerId),
    queryFn: () => adminApi.guardianLinks(institutionId!, learnerId),
    enabled: institutionId != null,
  });

  const change = useMutation({
    mutationFn: ({ link, kind }: LinkAction) => {
      if (kind === 'revoke') return adminApi.revokeLink(institutionId!, learnerId, link.guardianId);
      if (kind === 'restore') return adminApi.restoreLink(institutionId!, learnerId, link.guardianId);
      return adminApi.makeLinkTemporary(
        institutionId!,
        learnerId,
        link.guardianId,
        new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
      );
    },
    onSuccess: async (_res, { kind }) => {
      setNotice(SUCCESS[kind]);
      await queryClient.invalidateQueries({ queryKey: adminKeys.guardianLinks(institutionId!, learnerId) });
    },
  });

  if (institutionId == null) return null;

  const run = (action: LinkAction) => {
    setNotice('');
    change.mutate(action);
  };
  const linkButton = 'text-purple-300 underline hover:text-white disabled:opacity-50';

  return (
    <section className="glass-card mt-6 p-6" aria-labelledby="guardian-links-heading">
      <h2 id="guardian-links-heading" className="mb-2 text-lg font-semibold text-purple-200">
        Guardians &amp; caregivers
      </h2>
      <p className="mb-4 text-sm text-purple-300">
        Who can see this learner&apos;s information. A revoked or expired link immediately stops granting access.
      </p>

      {links.isError && (
        <Alert tone="error" className="mb-2">
          Could not load guardian links.
        </Alert>
      )}
      {change.isError && (
        <Alert tone="error" className="mb-2">
          {getErrorMessage(change.error, 'The change could not be saved.')}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" className="mb-2">
          {notice}
        </Alert>
      )}

      {links.isLoading ? (
        <LoadingState label="Loading links…" />
      ) : (links.data ?? []).length === 0 ? (
        <p className="text-purple-300">No guardian is linked to this learner yet.</p>
      ) : (
        <ul className="space-y-3">
          {links.data!.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/10 pb-3"
            >
              <div>
                <p className="text-purple-200">
                  {link.learnerName} · {link.guardianEmail}
                </p>
                <p className="text-xs text-purple-400">
                  {link.relationship.toLowerCase().replace(/_/g, ' ')}
                  {link.revoked ? ' · revoked' : link.active ? ' · active' : ' · expired'}
                  {link.expiresAt ? ` · expires ${formatDate(link.expiresAt)}` : ''}
                </p>
              </div>
              <div className="space-x-3 whitespace-nowrap">
                {link.revoked ? (
                  <button
                    type="button"
                    disabled={change.isPending}
                    onClick={() => run({ link, kind: 'restore' })}
                    className={linkButton}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={change.isPending}
                    onClick={() => run({ link, kind: 'revoke' })}
                    className={linkButton}
                  >
                    Revoke
                  </button>
                )}
                {!link.revoked && !link.expiresAt && (
                  <button
                    type="button"
                    disabled={change.isPending}
                    onClick={() => run({ link, kind: 'temporary' })}
                    className={linkButton}
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
