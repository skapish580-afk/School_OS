'use client';

interface Step5Props {
    programId: string;
    onComplete: () => void;
    onSkip: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}

export function Step5Curriculum({ programId, onComplete, onSkip, setLoading, setError }: Step5Props) {
    return (
        <div className="text-center py-12">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8 max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-purple-900 mb-4">Curriculum & Subject Mapping</h3>
                <p className="text-gray-700 mb-6">
                    This is an optional step. You can configure subject mapping for your academic programs later
                    from the school admin dashboard.
                </p>
                <p className="text-sm text-gray-600 mb-8">
                    Subject mapping allows you to define which subjects are taught in each grade,
                    assign teachers, and manage curriculum standards.
                </p>
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={onSkip}
                        className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                        Skip for Now
                    </button>
                </div>
            </div>
        </div>
    );
}
