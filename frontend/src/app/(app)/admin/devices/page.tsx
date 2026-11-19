import type { Metadata } from 'next';
import DevicesScreen from '@/features/devices/screens/DevicesScreen';

export const metadata: Metadata = { title: 'Devices' };

export default function Page() {
  return <DevicesScreen />;
}
