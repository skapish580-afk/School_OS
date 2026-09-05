'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentAssignmentsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/students/finance');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Redirecting to Finance & Fee Ledger...</p>
      </div>
    </div>
  );
}
