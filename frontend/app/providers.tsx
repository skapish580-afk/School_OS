'use client';

import { SettingsProvider } from '@/lib/SettingsContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </SettingsProvider>
  );
}
