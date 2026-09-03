'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const SCHOOL_TYPES = ['Primary School','Secondary School','SNE School','Special Unit','NGO','Homeschool','TVET','Other'];
const COUNTIES = ['Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii','Kisumu','Kitui',
  'Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit','Meru','Migori','Mombasa',
  "Murang'a",'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya',
  'Taita-Taveta','Tana River','Tharaka-Nithi','Trans-Nzoia','Turkana','Uasin Gishu','Vihiga',
  'Wajir','West Pokot'].sort();

export default function SchoolOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const [f, setF] = useState({
    name:'', type:'Primary School', county:'', subCounty:'',
    adminName:'', adminEmail:'', adminPassword:'', phone:''
  });
  const upd = (k:string,v:string) => setF(p=>({...p,[k]:v}));

  const next = () => { setErr(''); setStep(s=>s+1); };
  const back = () => setStep(s=>s-1);

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await api.post('/institutions/register',{
        name: f.name, type: f.type.toUpperCase().replace(/\s+/g,'_'),
        county: f.county, subCounty: f.subCounty || undefined,
        adminName: f.adminName, adminEmail: f.adminEmail,
        adminPassword: f.adminPassword, contactPhone: f.phone || undefined
      });
      router.push(`/login?welcome=1&email=${encodeURIComponent(f.adminEmail)}`);
    } catch (e) {
      const axiosErr = e as { response?: { data?: { message?: string } } };
      setErr(axiosErr.response?.data?.message || 'Registration failed — please try again.');
    } finally { setBusy(false); }
  };

  const canNext1 = f.name.trim().length > 2;
  const canNext2 = f.adminName && f.adminEmail.includes('@') && f.adminPassword.length >= 8;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏫</div>
          <h1 className="text-3xl font-bold text-white">Get started with Elekeza</h1>
          <p className="text-blue-200 mt-1 text-sm">For any school — mainstream, SNE, NGO, homeschool</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[1,2,3].map(s=>(
            <div key={s} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
              step===s?'bg-purple-500 border-purple-400 text-white':
              s<step?'bg-green-500 border-green-400 text-white':'bg-white/10 border-white/20 text-white/40'
            }`}>{s<step?'✓':s}</div>
          ))}
        </div>

        <div className="glass-card rounded-2xl shadow-2xl p-8">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-5">{err}</div>}

          {/* Step 1 — School */}
          {step===1 && <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-5">About your school</h2>
            <div className="space-y-4">
              <div>
                <label className="label">School name *</label>
                <input className="input-field" placeholder="e.g. Nairobi Primary School"
                  value={f.name} onChange={e=>upd('name',e.target.value)}/>
              </div>
              <div>
                <label className="label">School type</label>
                <select className="input-field" value={f.type} onChange={e=>upd('type',e.target.value)}>
                  {SCHOOL_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">County</label>
                  <select className="input-field" value={f.county} onChange={e=>upd('county',e.target.value)}>
                    <option value="">Select…</option>
                    {COUNTIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Sub-county</label>
                  <input className="input-field" placeholder="Optional" value={f.subCounty} onChange={e=>upd('subCounty',e.target.value)}/>
                </div>
              </div>
            </div>
            <button onClick={()=>{if(!canNext1){setErr('School name required');return;}next();}}
              className="btn-primary w-full mt-6">Next →</button>
          </div>}

          {/* Step 2 — Admin account */}
          {step===2 && <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Create admin account</h2>
            <p className="text-purple-200 text-sm mb-5">You&apos;ll manage teachers and students from this account</p>
            <div className="space-y-4">
              <div>
                <label className="label">Your full name *</label>
                <input className="input-field" placeholder="e.g. Alice Wanjiku"
                  value={f.adminName} onChange={e=>upd('adminName',e.target.value)}/>
              </div>
              <div>
                <label className="label">Email address *</label>
                <input className="input-field" type="email" placeholder="admin@school.ke"
                  value={f.adminEmail} onChange={e=>upd('adminEmail',e.target.value)}/>
              </div>
              <div>
                <label className="label">Password * (min 8 chars)</label>
                <input className="input-field" type="password"
                  value={f.adminPassword} onChange={e=>upd('adminPassword',e.target.value)}/>
              </div>
              <div>
                <label className="label">Phone number</label>
                <input className="input-field" placeholder="+254 712 345 678"
                  value={f.phone} onChange={e=>upd('phone',e.target.value)}/>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={back} className="btn-outline flex-1">← Back</button>
              <button onClick={()=>{if(!canNext2){setErr('All fields required (password ≥ 8 chars)');return;}next();}}
                className="btn-primary flex-1">Review →</button>
            </div>
          </div>}

          {/* Step 3 — Confirm */}
          {step===3 && <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-5">Confirm &amp; create</h2>
            <div className="glass-card rounded-xl p-4 space-y-2 text-sm mb-6">
              {[['School',f.name],['Type',f.type],['County',f.county||'—'],['Admin',f.adminName],['Email',f.adminEmail]].map(([k,v])=>(
                <div key={k} className="flex justify-between">
                  <span className="text-purple-300">{k}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={back} className="btn-outline flex-1">← Back</button>
              <button onClick={submit} disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
                {busy ? 'Creating…' : '✓ Create school'}
              </button>
            </div>
          </div>}
        </div>

        <p className="text-center text-blue-300 text-sm mt-5">
          Already registered? <a href="/login" className="text-white underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}


