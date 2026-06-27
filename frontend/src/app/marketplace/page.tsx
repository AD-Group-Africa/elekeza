'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function MarketplacePage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/marketplace/items')
      .then(res => setItems(res.data))
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Marketplace</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="card">
            <h2 className="font-semibold text-blue-900">{item.title}</h2>
            <p className="text-purple-600 font-bold mt-2">KES {item.price}</p>
            <button className="btn-primary mt-4 w-full">Purchase</button>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}
