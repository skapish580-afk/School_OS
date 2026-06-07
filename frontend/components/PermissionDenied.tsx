'use client';

import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

interface PermissionDeniedProps {
  title?: string;
  message?: string;
  showHomeLink?: boolean;
  showBackButton?: boolean;
}

export default function PermissionDenied({
  title = "Access Denied",
  message = "You don't have permission to access this resource. Please contact your administrator if you believe this is an error.",
  showHomeLink = true,
  showBackButton = true,
}: PermissionDeniedProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-red-100 shadow-lg p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        
        {/* Message */}
        <p className="text-gray-600 mb-6">{message}</p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBackButton && (
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              <ArrowLeft size={18} />
              Go Back
            </button>
          )}
          {showHomeLink && (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Home size={18} />
              Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
