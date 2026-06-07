'use client';

import { useState } from 'react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';

interface Step4Props {
    schoolId: string;
    campusId: string;
    onComplete: (programId: string) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}

interface Grade {
    grade_name: string;
    grade_order: number;
    max_sections: number;
    default_section_names: string[];
}

export function Step4Programs({ schoolId, campusId, onComplete, setLoading, setError }: Step4Props) {
    const [step, setStep] = useState<'program' | 'grades'>('program');
    const [programId, setProgramId] = useState('');

    const [programData, setProgramData] = useState({
        name: '',
        code: '',
        board: 'CBSE',
        education_level: 'PRIMARY',
        medium_of_instruction: 'English',
        evaluation_system: 'MARKS',
        academic_pattern: 'ANNUAL',
    });

    const [grades, setGrades] = useState<Grade[]>([
        { grade_name: 'LKG', grade_order: 1, max_sections: 2, default_section_names: ['A', 'B'] },
        { grade_name: 'UKG', grade_order: 2, max_sections: 2, default_section_names: ['A', 'B'] },
    ]);

    const handleProgramSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(
                'http://localhost:8000/api/v1/owner/onboarding/step4a/',
                {
                    school_id: schoolId,
                    campus_id: campusId || null,
                    ...programData,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setProgramId(response.data.program_id);
                setStep('grades');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create program');
        } finally {
            setLoading(false);
        }
    };

    const handleGradesSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(
                'http://localhost:8000/api/v1/owner/onboarding/step4b/',
                {
                    program_id: programId,
                    grades: grades,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                onComplete(programId);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to add grades');
        } finally {
            setLoading(false);
        }
    };

    const addGrade = () => {
        const nextOrder = grades.length > 0 ? Math.max(...grades.map(g => g.grade_order)) + 1 : 1;
        setGrades([...grades, {
            grade_name: String(nextOrder),
            grade_order: nextOrder,
            max_sections: 1,
            default_section_names: ['A'],
        }]);
    };

    const removeGrade = (index: number) => {
        setGrades(grades.filter((_, i) => i !== index));
    };

    const updateGrade = (index: number, field: keyof Grade, value: any) => {
        const updated = [...grades];
        updated[index] = { ...updated[index], [field]: value };
        setGrades(updated);
    };

    if (step === 'program') {
        return (
            <form onSubmit={handleProgramSubmit} className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                        <strong>Core Philosophy:</strong> Schools are NOT single structures. A school = multiple academic programs.
                        Programs own boards, grades, and rules. Different boards can coexist with different configurations.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Program Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={programData.name}
                            onChange={(e) => setProgramData({ ...programData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Primary Wing"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Program Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={programData.code}
                            onChange={(e) => setProgramData({ ...programData, code: e.target.value.toUpperCase() })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="PRI"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Board <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={programData.board}
                            onChange={(e) => setProgramData({ ...programData, board: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="CBSE">CBSE</option>
                            <option value="ICSE">ICSE</option>
                            <option value="SSC">SSC (State Board)</option>
                            <option value="IB">International Baccalaureate</option>
                            <option value="IGCSE">IGCSE</option>
                            <option value="CUSTOM">Custom</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Education Level
                        </label>
                        <select
                            value={programData.education_level}
                            onChange={(e) => setProgramData({ ...programData, education_level: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="PRE_PRIMARY">Pre-Primary</option>
                            <option value="PRIMARY">Primary</option>
                            <option value="MIDDLE">Middle School</option>
                            <option value="SECONDARY">Secondary</option>
                            <option value="SENIOR_SECONDARY">Senior Secondary</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Medium of Instruction
                        </label>
                        <input
                            type="text"
                            value={programData.medium_of_instruction}
                            onChange={(e) => setProgramData({ ...programData, medium_of_instruction: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Evaluation System
                        </label>
                        <select
                            value={programData.evaluation_system}
                            onChange={(e) => setProgramData({ ...programData, evaluation_system: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="MARKS">Marks Based</option>
                            <option value="GRADES">Grade Based</option>
                            <option value="HYBRID">Hybrid</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Academic Pattern
                        </label>
                        <select
                            value={programData.academic_pattern}
                            onChange={(e) => setProgramData({ ...programData, academic_pattern: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ANNUAL">Annual</option>
                            <option value="SEMESTER">Semester</option>
                            <option value="TERM">Term</option>
                        </select>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    Create Program & Add Grades
                </button>
            </form>
        );
    }

    return (
        <form onSubmit={handleGradesSubmit} className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-900">
                    <strong>Grades as TEXT:</strong> Use "LKG", "UKG", "1", "2", etc. The grade_order determines sorting and promotion logic.
                </p>
            </div>

            <div className="space-y-4">
                {grades.map((grade, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 grid grid-cols-5 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Grade Name</label>
                            <input
                                type="text"
                                required
                                value={grade.grade_name}
                                onChange={(e) => updateGrade(index, 'grade_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="LKG"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Order</label>
                            <input
                                type="number"
                                required
                                value={grade.grade_order}
                                onChange={(e) => updateGrade(index, 'grade_order', parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Max Sections</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={grade.max_sections}
                                onChange={(e) => updateGrade(index, 'max_sections', parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Sections</label>
                            <input
                                type="text"
                                value={grade.default_section_names.join(', ')}
                                onChange={(e) => updateGrade(index, 'default_section_names', e.target.value.split(',').map(s => s.trim()))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="A, B, C"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => removeGrade(index)}
                            className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={addGrade}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
                <Plus className="h-5 w-5" />
                Add Grade
            </button>

            <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
                Save Grades & Continue
            </button>
        </form>
    );
}
