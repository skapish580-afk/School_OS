import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-white to-gray-50">
      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <h1 className="text-7xl font-black text-gray-900 tracking-tight">
          School<span className="text-blue-600">OS</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          The comprehensive operating system for modern education. Manage students, teachers, finances, and more with a single, unified platform.
        </p>
        
        <div className="flex gap-4 justify-center pt-4">
          <Link 
            href="/onboarding" 
            className="bg-black text-white px-8 py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-xl hover:shadow-black/10 scale-100 hover:scale-105 active:scale-95"
          >
            Register School
          </Link>
          <Link 
            href="/login" 
            className="bg-white text-gray-900 border-2 border-gray-100 px-8 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm scale-100 hover:scale-105 active:scale-95"
          >
            Login
          </Link>
        </div>
        
        <div className="pt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="text-3xl mb-4">🏫</div>
            <h3 className="font-bold text-gray-900">Multi-Tenant</h3>
            <p className="text-sm text-gray-500 mt-2">Isolated, secure data environments for every institution.</p>
          </div>
          <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="text-3xl mb-4">💳</div>
            <h3 className="font-bold text-gray-900">Finance & Fee</h3>
            <p className="text-sm text-gray-500 mt-2">Automated invoicing and payment tracking built-in.</p>
          </div>
          <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="text-3xl mb-4">📱</div>
            <h3 className="font-bold text-gray-900">Digital Pass</h3>
            <p className="text-sm text-gray-500 mt-2">Secure, QR-based gatepass system for student safety.</p>
          </div>
        </div>
      </div>
    </main>
  );
}