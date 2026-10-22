'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Field, TextInput } from '@/components/ui';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { getErrorMessage } from '@/lib/api';
import { waitlistApi } from '../api';

export default function WaitlistScreen() {
  const [form, setForm] = useState({ name: '', email: '', school: '' });
  const join = useMutation({ mutationFn: () => waitlistApi.join(form) });

  if (join.isSuccess) {
    return (
      <AuthCard title="Thank you!">
        <p className="text-center text-purple-200" role="status">
          We&apos;ll be in touch.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Join the Waitlist">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join.mutate();
        }}
        className="space-y-4"
      >
        <Field id="wl-name" label="Your name">
          <TextInput
            id="wl-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
            required
          />
        </Field>
        <Field id="wl-email" label="Email">
          <TextInput
            id="wl-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            required
          />
        </Field>
        <Field id="wl-school" label="School name">
          <TextInput
            id="wl-school"
            value={form.school}
            onChange={(e) => setForm({ ...form, school: e.target.value })}
            required
          />
        </Field>
        {join.isError && (
          <Alert tone="error">{getErrorMessage(join.error, 'Could not join the waitlist. Please try again.')}</Alert>
        )}
        <Button type="submit" size="lg" className="w-full" loading={join.isPending}>
          Join
        </Button>
      </form>
    </AuthCard>
  );
}
