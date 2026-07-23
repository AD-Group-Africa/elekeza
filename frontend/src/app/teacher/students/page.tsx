'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Search, Plus, User } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  sneType: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSneType, setNewSneType] = useState('NONE');
  const [message, setMessage] = useState('');

  const fetchStudents = async () => {
    try {
      const res = await api.get('/teacher/students');
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/teacher/student', {
        email: newEmail,
        fullName: newName,
        password: newPassword,
        sneType: newSneType,
      });
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewSneType('NONE');
      setShowForm(false);
      setMessage('Student added successfully!');
      fetchStudents();
    } catch (err) {
      setMessage('Failed to add student.');
    }
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-purple-200">Student Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> Add Student
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-purple-200 mb-4">Add New Student</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full Name" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <select value={newSneType} onChange={e => setNewSneType(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white">
              <option value="NONE">No SNE</option>
              <option value="DYSLEXIA">Dyslexia</option>
              <option value="ADHD">ADHD</option>
              <option value="AUTISM">Autism</option>
              <option value="INTELLECTUAL">Intellectual Disability</option>
            </select>
            <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg">Add</button>
          </form>
          {message && <p className="text-purple-300 text-sm">{message}</p>}
        </div>
      )}

      <div className="glass-card p-4">
        <div className="relative mb-4">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white"
          />
        </div>
        {loading ? (
          <p className="text-purple-300">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <User size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No students found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-purple-200">
              <thead className="text-purple-300 text-sm">
                <tr>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">SNE Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-t border-purple-300/10">
                    <td className="py-3">{s.name}</td>
                    <td className="py-3 text-purple-300">{s.email}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-purple-600/40">{s.sneType || 'None'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}