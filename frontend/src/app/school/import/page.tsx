'use client';
import { useState, useRef } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Result { status:string; totalRows:number; succeededRows:number; failedRows:number; errors:{row:number;error:string}[]; }

export default function ImportPage() {
  const { user }    = useAuth();
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<File|null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result|null>(null);
  const [err, setErr]   = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const institutionId = (user as any)?.institutionId ?? 1;

  const onDrop = (e:React.DragEvent) => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files[0];
    if(f?.name.endsWith('.csv')) { setFile(f); setErr(''); }
    else setErr('Only .csv files are supported');
  };

  const upload = async () => {
    if(!file) return;
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post(`/institutions/${institutionId}/students/import`, fd,
        { headers: {'Content-Type':'multipart/form-data'} });
      setResult(res.data);
    } catch(e:any) {
      setErr(e.response?.data?.message || 'Import failed — check your CSV format and try again.');
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const csv = [
      'firstName,lastName,grade,sneType,guardianEmail,guardianPhone,guardianName,guardianRelationship',
      'Amina,Ali,Grade 4,DYSLEXIA,fatuma@example.com,+254712345678,Fatuma Ali,Mother',
      'Juma,Osei,Grade 3,NONE,,,,',
      'Baraka,Kamau,Grade 5,ADHD,james@example.com,+254723456789,James Kamau,Father'
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'elekeza_import_template.csv'; a.click();
  };

  return (
    <SidebarLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Import Students</h1>
          <p className="text-blue-200 mt-1">Add multiple learners at once from a spreadsheet</p>
        </div>

        {/* Template + SNE guide */}
        <div className="card mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-blue-900">Download CSV template</h3>
            <p className="text-sm text-purple-300 mt-0.5">Fill it in and upload below. Only firstName &amp; lastName are required.</p>
          </div>
          <button onClick={downloadTemplate} className="btn-outline text-sm whitespace-nowrap">⬇ Template</button>
        </div>

        <div className="card mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">Column guide</h3>
          <div className="overflow-x-auto text-sm">
            <table className="w-full">
              <thead><tr className="text-purple-200 border-b text-left">
                <th className="pb-2 pr-6 font-medium">Column</th>
                <th className="pb-2 pr-6 font-medium">Required</th>
                <th className="pb-2 font-medium">Values</th>
              </tr></thead>
              <tbody>
                {[
                  ['firstName','✓','Any'],
                  ['lastName','✓','Any'],
                  ['grade','','Grade 1–12, PP1, PP2'],
                  ['sneType','','DYSLEXIA | ADHD | AUTISM | INTELLECTUAL_DISABILITY | NONE'],
                  ['guardianEmail','','Parent email — for progress notifications'],
                  ['guardianPhone','','E.g. +254712345678'],
                  ['guardianName','','Full name of parent/guardian'],
                  ['guardianRelationship','','Mother | Father | Guardian | Sibling'],
                ].map(([col,req,vals])=>(
                  <tr key={col} className="border-b last:border-0">
                    <td className="py-2 pr-6 font-mono text-purple-700 text-xs">{col}</td>
                    <td className="py-2 pr-6 text-center text-green-600 font-bold">{req}</td>
                    <td className="py-2 text-purple-300 text-xs">{vals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drop zone */}
        {!result && (
          <>
            <div
              onDragOver={e=>{e.preventDefault();setOver(true);}}
              onDragLeave={()=>setOver(false)}
              onDrop={onDrop}
              onClick={()=>ref.current?.click()}
              className={`card border-2 border-dashed text-center cursor-pointer transition-all ${
                over?'border-purple-400 bg-purple-50':'border-gray-300 hover:border-purple-300 hover:bg-gray-50'
              }`}
            >
              <input ref={ref} type="file" accept=".csv" className="hidden"
                onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);setErr('');}}}/>
              <div className="text-5xl mb-3">{file?'📄':'⬆️'}</div>
              {file
                ? <p className="font-semibold text-gray-800">{file.name}</p>
                : <>
                    <p className="text-gray-600 font-medium">Drop your CSV here, or click to browse</p>
                    <p className="text-purple-200 text-sm mt-1">.csv files only</p>
                  </>
              }
            </div>
            {err && <p className="text-red-600 text-sm mt-2">{err}</p>}
            {file && (
              <button onClick={upload} disabled={busy}
                className="btn-primary w-full mt-4 disabled:opacity-60">
                {busy?'Importing…':`Import ${file.name}`}
              </button>
            )}
          </>
        )}

        {/* Results */}
        {result && (
          <div className="card mt-4">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-4xl">{result.failedRows===0?'✅':'⚠️'}</span>
              <div>
                <h3 className="font-semibold text-blue-900 text-lg">Import complete</h3>
                <p className="text-purple-300 text-sm">{result.succeededRows} students added · {result.failedRows} failed</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[['Total',result.totalRows,'text-blue-600'],['Added',result.succeededRows,'text-green-600'],['Failed',result.failedRows,'text-red-500']].map(([l,v,c])=>(
                <div key={String(l)} className="glass-card rounded-xl py-4 text-center">
                  <div className={`text-2xl font-bold ${c}`}>{v}</div>
                  <div className="text-xs text-purple-200 mt-1">{l}</div>
                </div>
              ))}
            </div>
            {result.errors.length>0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Row errors</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map(e=>(
                    <li key={e.row} className="text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <span className="font-mono text-red-500">Row {e.row}:</span> {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={()=>{setResult(null);setFile(null);}} className="btn-outline flex-1">Import more</button>
              <button onClick={()=>window.location.href='/teacher'} className="btn-primary flex-1">Go to dashboard</button>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}


