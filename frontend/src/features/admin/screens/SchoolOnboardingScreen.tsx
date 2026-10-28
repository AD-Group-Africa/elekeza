'use client';

/**
 * Public school registration: creates the institution and its first school
 * administrator, then sends them to sign in.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Field, Select, TextInput } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { adminApi } from '../api';

const SCHOOL_TYPES = [
  'Primary School',
  'Secondary School',
  'SNE School',
  'Special Unit',
  'NGO',
  'Homeschool',
  'TVET',
  'Other',
];
const COUNTIES = [
  'Baringo',
  'Bomet',
  'Bungoma',
  'Busia',
  'Elgeyo-Marakwet',
  'Embu',
  'Garissa',
  'Homa Bay',
  'Isiolo',
  'Kajiado',
  'Kakamega',
  'Kericho',
  'Kiambu',
  'Kilifi',
  'Kirinyaga',
  'Kisii',
  'Kisumu',
  'Kitui',
  'Kwale',
  'Laikipia',
  'Lamu',
  'Machakos',
  'Makueni',
  'Mandera',
  'Marsabit',
  'Meru',
  'Migori',
  'Mombasa',
  "Murang'a",
  'Nairobi',
  'Nakuru',
  'Nandi',
  'Narok',
  'Nyamira',
  'Nyandarua',
  'Nyeri',
  'Samburu',
  'Siaya',
  'Taita-Taveta',
  'Tana River',
  'Tharaka-Nithi',
  'Trans-Nzoia',
  'Turkana',
  'Uasin Gishu',
  'Vihiga',
  'Wajir',
  'West Pokot',
];

const EMPTY = {
  name: '',
  type: 'Primary School',
  county: '',
  subCounty: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  phone: '',
};

/** The API needs first + last name; a single name is used for both. */
function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] || '';
  return { adminFirstName: first, adminLastName: parts.slice(1).join(' ') || first };
}

export default function SchoolOnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const update = (key: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const register = useMutation({
    mutationFn: () =>
      adminApi.registerSchool({
        name: form.name,
        type: form.type.toUpperCase().replace(/\s+/g, '_'),
        county: form.county,
        subCounty: form.subCounty || undefined,
        ...splitName(form.adminName),
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
        contactPhone: form.phone || undefined,
      }),
    onSuccess: () => router.push(`/login?welcome=1&email=${encodeURIComponent(form.adminEmail)}`),
    onError: (e) => setError(getErrorMessage(e, 'Registration failed — please try again.')),
  });

  const goTo = (next: number) => {
    setError('');
    setStep(next);
  };
  const schoolValid = form.name.trim().length > 2;
  const adminValid = form.adminName.trim() !== '' && form.adminEmail.includes('@') && form.adminPassword.length >= 8;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">
            🏫
          </div>
          <h1 className="text-3xl font-bold text-white">Get started with Elekeza</h1>
          <p className="mt-1 text-sm text-blue-200">For any school — mainstream, SNE, NGO, homeschool</p>
        </div>

        <ol className="mb-6 flex justify-center gap-3" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((s) => (
            <li
              key={s}
              aria-current={step === s ? 'step' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                step === s
                  ? 'border-purple-400 bg-purple-500 text-white'
                  : s < step
                    ? 'border-green-400 bg-green-500 text-white'
                    : 'border-white/20 bg-white/10 text-white/40',
              )}
            >
              {s < step ? '✓' : s}
            </li>
          ))}
        </ol>

        <Card padding="lg" className="rounded-2xl shadow-2xl">
          {error && (
            <Alert tone="error" className="mb-5">
              {error}
            </Alert>
          )}

          {step === 1 && (
            <div>
              <h2 className="mb-5 text-xl font-semibold text-purple-100">About your school</h2>
              <div className="space-y-4">
                <Field id="school-name" label="School name *">
                  <TextInput
                    id="school-name"
                    placeholder="e.g. Nairobi Primary School"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                  />
                </Field>
                <Field id="school-type" label="School type">
                  <Select id="school-type" value={form.type} onChange={(e) => update('type', e.target.value)}>
                    {SCHOOL_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="school-county" label="County">
                    <Select id="school-county" value={form.county} onChange={(e) => update('county', e.target.value)}>
                      <option value="">Select…</option>
                      {COUNTIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="school-subcounty" label="Sub-county">
                    <TextInput
                      id="school-subcounty"
                      placeholder="Optional"
                      value={form.subCounty}
                      onChange={(e) => update('subCounty', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <Button
                size="lg"
                className="mt-6 w-full"
                onClick={() => (schoolValid ? goTo(2) : setError('School name required'))}
              >
                Next →
              </Button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-1 text-xl font-semibold text-purple-100">Create admin account</h2>
              <p className="mb-5 text-sm text-purple-200">You&apos;ll manage teachers and students from this account</p>
              <div className="space-y-4">
                <Field id="admin-name" label="Your full name *">
                  <TextInput
                    id="admin-name"
                    placeholder="e.g. Alice Wanjiku"
                    autoComplete="name"
                    value={form.adminName}
                    onChange={(e) => update('adminName', e.target.value)}
                  />
                </Field>
                <Field id="admin-email" label="Email address *">
                  <TextInput
                    id="admin-email"
                    type="email"
                    placeholder="admin@school.ke"
                    autoComplete="email"
                    value={form.adminEmail}
                    onChange={(e) => update('adminEmail', e.target.value)}
                  />
                </Field>
                <Field id="admin-password" label="Password * (min 8 chars)">
                  <TextInput
                    id="admin-password"
                    type="password"
                    autoComplete="new-password"
                    value={form.adminPassword}
                    onChange={(e) => update('adminPassword', e.target.value)}
                  />
                </Field>
                <Field id="admin-phone" label="Phone number">
                  <TextInput
                    id="admin-phone"
                    type="tel"
                    placeholder="+254 712 345 678"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => goTo(1)}>
                  ← Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => (adminValid ? goTo(3) : setError('All fields required (password ≥ 8 chars)'))}
                >
                  Review →
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-5 text-xl font-semibold text-purple-100">Confirm &amp; create</h2>
              <dl className="mb-6 space-y-2 rounded-xl bg-white/5 p-4 text-sm">
                {[
                  ['School', form.name],
                  ['Type', form.type],
                  ['County', form.county || '—'],
                  ['Admin', form.adminName],
                  ['Email', form.adminEmail],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-purple-300">{k}</dt>
                    <dd className="font-medium text-purple-100">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => goTo(2)}>
                  ← Back
                </Button>
                <Button className="flex-1" onClick={() => register.mutate()} loading={register.isPending}>
                  {register.isPending ? 'Creating…' : '✓ Create school'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="mt-5 text-center text-sm text-blue-300">
          Already registered?{' '}
          <Link href="/login" className="text-white underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
