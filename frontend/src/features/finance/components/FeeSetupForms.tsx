'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Field, Select, TextInput } from '@/components/ui';
import { useClasses } from '@/features/attendance/api';
import { getErrorMessage } from '@/lib/api';
import { financeApi, financeKeys, type FeeItemInfo, type PeriodInfo } from '../api';

type Notify = (tone: 'success' | 'error', text: string) => void;

function useFinanceMutation<T>(
  fn: (input: T) => Promise<unknown>,
  success: string,
  notify: Notify,
  after?: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      notify('success', success);
      after?.();
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
    onError: (err) => notify('error', getErrorMessage(err, 'Could not save. Check the details and try again.')),
  });
}

/** Academic period (term) creation. */
export function NewPeriodForm({ notify }: { notify: Notify }) {
  const [name, setName] = useState('');
  const [startDate, setStart] = useState('');
  const [endDate, setEnd] = useState('');
  const [isCurrent, setCurrent] = useState(true);
  const save = useFinanceMutation(
    () =>
      financeApi.createPeriod({
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        isCurrent,
      }),
    `Period "${name.trim()}" created.`,
    notify,
    () => setName(''),
  );
  return (
    <Card title="Add a term / period">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field id="period-name" label="Name" className="sm:col-span-2">
          <TextInput
            id="period-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Term 1 2027"
            required
          />
        </Field>
        <Field id="period-start" label="Starts">
          <TextInput id="period-start" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field id="period-end" label="Ends">
          <TextInput id="period-end" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-purple-200 sm:col-span-2">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={(e) => setCurrent(e.target.checked)}
            className="h-4 w-4"
          />
          This is the current term
        </label>
        <Button type="submit" loading={save.isPending} className="sm:col-span-2">
          Add period
        </Button>
      </form>
    </Card>
  );
}

/** Fee item (e.g. Tuition) with a default amount. */
export function NewFeeItemForm({ notify }: { notify: Notify }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const save = useFinanceMutation(
    () =>
      financeApi.createFeeItem({
        name: name.trim(),
        amount: Number(amount),
        description: description.trim() || undefined,
      }),
    `Fee item "${name.trim()}" created.`,
    notify,
    () => {
      setName('');
      setAmount('');
      setDescription('');
    },
  );
  return (
    <Card title="Add a fee item">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!(Number(amount) > 0)) return notify('error', 'Enter an amount greater than zero.');
          save.mutate(undefined);
        }}
      >
        <Field id="item-name" label="Name">
          <TextInput
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tuition"
            required
          />
        </Field>
        <Field id="item-amount" label="Default amount (KES)">
          <TextInput
            id="item-amount"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
        <Field id="item-description" label="Description (optional)" className="sm:col-span-2">
          <TextInput id="item-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button type="submit" loading={save.isPending} className="sm:col-span-2">
          Add fee item
        </Button>
      </form>
    </Card>
  );
}

/** Fee structure: what one fee item costs in one period, for a class or the whole school. */
export function NewStructureForm({
  periods,
  items,
  notify,
}: {
  periods: PeriodInfo[];
  items: FeeItemInfo[];
  notify: Notify;
}) {
  const classes = useClasses();
  const [periodId, setPeriodId] = useState('');
  const [feeItemId, setFeeItemId] = useState('');
  const [classId, setClassId] = useState('');
  const [amount, setAmount] = useState('');
  const current = periods.find((p) => p.isCurrent) ?? periods[0];
  const effectivePeriod = periodId || (current ? String(current.id) : '');
  const chosenItem = items.find((i) => String(i.id) === feeItemId);

  const save = useFinanceMutation(
    () =>
      financeApi.createStructure({
        periodId: Number(effectivePeriod),
        feeItemId: Number(feeItemId),
        classId: classId ? Number(classId) : null,
        amount: Number(amount || chosenItem?.amount || 0),
      }),
    'Fee structure created. Press “Bill learners” to create the invoices.',
    notify,
    () => {
      setFeeItemId('');
      setAmount('');
      setClassId('');
    },
  );

  if (periods.length === 0 || items.length === 0) {
    return (
      <Card title="Add a fee structure">
        <p className="text-sm text-purple-300">Create at least one period and one fee item first.</p>
      </Card>
    );
  }

  return (
    <Card title="Add a fee structure">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!effectivePeriod || !feeItemId) return notify('error', 'Choose a period and a fee item.');
          save.mutate(undefined);
        }}
      >
        <Field id="structure-period" label="Period">
          <Select id="structure-period" value={effectivePeriod} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isCurrent ? ' (current)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="structure-item" label="Fee item">
          <Select id="structure-item" value={feeItemId} onChange={(e) => setFeeItemId(e.target.value)} required>
            <option value="">Choose…</option>
            {items
              .filter((i) => i.active)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field id="structure-class" label="Applies to">
          <Select id="structure-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Whole school</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="structure-amount"
          label="Amount (KES)"
          hint={chosenItem ? `Leave empty to use ${chosenItem.amount}` : undefined}
        >
          <TextInput
            id="structure-amount"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Button type="submit" loading={save.isPending} className="sm:col-span-2">
          Add fee structure
        </Button>
      </form>
    </Card>
  );
}

/** A one-off charge for a single learner (e.g. a trip). */
export function NewChargeForm({
  periods,
  items,
  learners,
  notify,
}: {
  periods: PeriodInfo[];
  items: FeeItemInfo[];
  learners: Array<{ id: number; name: string }>;
  notify: Notify;
}) {
  const [learnerId, setLearnerId] = useState('');
  const [feeItemId, setFeeItemId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const current = periods.find((p) => p.isCurrent) ?? periods[0];
  const chosenItem = items.find((i) => String(i.id) === feeItemId);

  const save = useFinanceMutation(
    () =>
      financeApi.createCharge({
        learnerId: Number(learnerId),
        periodId: current!.id,
        feeItemId: Number(feeItemId),
        amount: Number(amount || chosenItem?.amount || 0),
        dueDate: dueDate || undefined,
        description: description.trim() || undefined,
      }),
    'Charge added to the learner’s invoices.',
    notify,
    () => {
      setAmount('');
      setDescription('');
    },
  );

  if (!current || items.length === 0) return null;

  return (
    <Card title="Charge one learner">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!learnerId || !feeItemId) return notify('error', 'Choose a learner and a fee item.');
          save.mutate(undefined);
        }}
      >
        <Field id="charge-learner" label="Learner">
          <Select id="charge-learner" value={learnerId} onChange={(e) => setLearnerId(e.target.value)} required>
            <option value="">Choose…</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="charge-item" label="Fee item">
          <Select id="charge-item" value={feeItemId} onChange={(e) => setFeeItemId(e.target.value)} required>
            <option value="">Choose…</option>
            {items
              .filter((i) => i.active)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field
          id="charge-amount"
          label="Amount (KES)"
          hint={chosenItem ? `Leave empty to use ${chosenItem.amount}` : undefined}
        >
          <TextInput
            id="charge-amount"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field id="charge-due" label="Due date (optional)">
          <TextInput id="charge-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field id="charge-description" label="Note (optional)" className="sm:col-span-2">
          <TextInput
            id="charge-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Science trip"
          />
        </Field>
        <p className="text-xs text-purple-300 sm:col-span-2">Billed to the current period: {current.name}.</p>
        <Button type="submit" loading={save.isPending} className="sm:col-span-2">
          Add charge
        </Button>
      </form>
    </Card>
  );
}
