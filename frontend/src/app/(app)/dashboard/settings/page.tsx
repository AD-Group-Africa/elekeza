import type { Metadata } from 'next';
import AccessibilitySettingsScreen from '@/features/accessibility/screens/AccessibilitySettingsScreen';

export const metadata: Metadata = { title: 'Accessibility settings' };

export default function Page() {
  return <AccessibilitySettingsScreen />;
}
