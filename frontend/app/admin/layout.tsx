'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { PermissionProvider } from '@/lib/rbac-context';
import { FeatureProvider } from '@/lib/FeatureContext';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionProvider>
      <FeatureProvider>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Navbar />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </FeatureProvider>
    </PermissionProvider>
  );
}
