'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { PermissionProvider } from '@/lib/rbac-context';
import { FeatureProvider } from '@/lib/FeatureContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionProvider>
      <FeatureProvider>
        <div className="min-h-screen bg-gray-50 flex">
          {/* 1. Fixed Sidebar */}
          <Sidebar />

          {/* 2. Main Content Area */}
          <div className="flex-1 ml-64 flex flex-col">
            {/* Fixed Navbar */}
            <Navbar />

            {/* Scrollable Page Content */}
            <main className="flex-1 mt-16 p-8 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </FeatureProvider>
    </PermissionProvider>
  );
}