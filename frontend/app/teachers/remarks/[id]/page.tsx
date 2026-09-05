'use client';

import StudentDetailPage from '@/app/dashboard/students/[id]/page';
import { useParams } from 'next/navigation';

export default function TeacherPortalStudentDetailPage({ params }: { params?: any }) {
  const routerParams = useParams();
  const id = params?.id || routerParams?.id;
  return <StudentDetailPage params={{ id }} />;
}
