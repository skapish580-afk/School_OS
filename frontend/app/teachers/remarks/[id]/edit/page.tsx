'use client';

import EditStudentPage from '@/app/dashboard/students/[id]/edit/page';
import { useParams } from 'next/navigation';

export default function TeacherPortalEditStudentPage({ params }: { params?: any }) {
  const routerParams = useParams();
  const id = params?.id || routerParams?.id;
  return <EditStudentPage params={{ id }} />;
}
