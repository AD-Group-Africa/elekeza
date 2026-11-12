'use client';

/**
 * Curriculum — the CBC hierarchy (learning area › strand › sub-strand ›
 * competency › objective). Everyone on staff can browse it; school admins can
 * add to it. Teachers link lessons to objectives from the Lessons page, which
 * feeds competency progress for learners and classes.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Route } from 'lucide-react';
import { Alert, Button, Card, EmptyState, LoadingState, PageHeader, TextInput } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { getErrorMessage } from '@/lib/api';
import { isSchoolAdmin } from '@/lib/roles';
import { curriculumApi, curriculumKeys, useCurriculumTree, type NodeLevel } from '../api';

const CHILD_LABEL: Record<NodeLevel, string> = {
  area: 'learning area',
  strand: 'strand',
  subStrand: 'sub-strand',
  competency: 'competency',
  objective: 'objective',
};

/** Small inline "add" form for one level of the tree. */
function AddNode({
  level,
  parentId,
  onDone,
}: {
  level: NodeLevel;
  parentId?: number;
  onDone: (msg: string, ok: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [text, setText] = useState('');
  const save = useMutation({
    mutationFn: () => curriculumApi.create(level, parentId, code.trim(), text.trim()),
    onSuccess: async () => {
      onDone(`Added ${CHILD_LABEL[level]} “${text.trim()}”.`, true);
      setCode('');
      setText('');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: curriculumKeys.tree });
    },
    onError: (err) => onDone(getErrorMessage(err, `Could not add the ${CHILD_LABEL[level]}.`), false),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-purple-300 hover:text-white"
      >
        <Plus size={12} aria-hidden="true" /> Add {CHILD_LABEL[level]}
      </button>
    );
  }
  const textLabel = level === 'objective' ? 'Objective statement' : 'Name';
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <TextInput
        aria-label="Code"
        placeholder="Code e.g. LIT-1"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-32 py-1.5 text-sm"
        required
      />
      <TextInput
        aria-label={textLabel}
        placeholder={textLabel}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-w-[12rem] flex-1 py-1.5 text-sm"
        required
      />
      <Button type="submit" size="sm" loading={save.isPending}>
        Add
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

/** Collapsible tree row. */
function Branch({
  title,
  code,
  children,
  defaultOpen = false,
}: {
  title: string;
  code: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 py-1 text-left text-purple-100 hover:text-white"
      >
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span className="font-mono text-xs text-purple-400">{code}</span>
        <span>{title}</span>
      </button>
      {open && <div className="ml-6 space-y-2 border-l border-white/10 pl-4">{children}</div>}
    </li>
  );
}

export default function CurriculumScreen() {
  const tree = useCurriculumTree();
  const { user } = useAuth();
  const canEdit = isSchoolAdmin(user?.role);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const done = (text: string, ok: boolean) => setMessage({ tone: ok ? 'success' : 'error', text });
  const areas = tree.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum"
        description="Learning areas, strands, competencies and objectives. Link lessons to objectives from the Lessons page to track competency progress."
      />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {canEdit && (
        <Card>
          <AddNode level="area" onDone={done} />
        </Card>
      )}

      {tree.isLoading ? (
        <LoadingState />
      ) : tree.isError ? (
        <Alert tone="error">Could not load the curriculum.</Alert>
      ) : areas.length === 0 ? (
        <EmptyState
          icon={<Route size={48} />}
          title="No curriculum yet."
          description={
            canEdit ? 'Add your first learning area above (e.g. Literacy).' : 'Your school administrator can set it up.'
          }
        />
      ) : (
        <Card>
          <ul className="space-y-2">
            {areas.map((area) => (
              <Branch
                key={area.id}
                title={`${area.name}${area.shared ? ' (shared)' : ''}`}
                code={area.code}
                defaultOpen={areas.length === 1}
              >
                <ul className="space-y-2">
                  {area.strands.map((strand) => (
                    <Branch key={strand.id} title={strand.name} code={strand.code}>
                      <ul className="space-y-2">
                        {strand.subStrands.map((sub) => (
                          <Branch key={sub.id} title={sub.name} code={sub.code}>
                            <ul className="space-y-2">
                              {sub.competencies.map((comp) => (
                                <Branch key={comp.id} title={comp.name} code={comp.code}>
                                  <ul className="list-disc space-y-1 pl-4 text-sm text-purple-200">
                                    {comp.objectives.map((o) => (
                                      <li key={o.id}>
                                        <span className="font-mono text-xs text-purple-400">{o.code}</span>{' '}
                                        {o.statement}
                                      </li>
                                    ))}
                                  </ul>
                                  {canEdit && <AddNode level="objective" parentId={comp.id} onDone={done} />}
                                </Branch>
                              ))}
                            </ul>
                            {canEdit && <AddNode level="competency" parentId={sub.id} onDone={done} />}
                          </Branch>
                        ))}
                      </ul>
                      {canEdit && <AddNode level="subStrand" parentId={strand.id} onDone={done} />}
                    </Branch>
                  ))}
                </ul>
                {canEdit && <AddNode level="strand" parentId={area.id} onDone={done} />}
              </Branch>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
