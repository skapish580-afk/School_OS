'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Building2,
    UserPlus,
    MapPin,
    GraduationCap,
    BookOpen,
    Zap,
    DollarSign,
    Shield,
    Palette,
    FileCheck,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Loader2
} from 'lucide-react';

// Import step components
import { Step1SchoolIdentity } from './components/Step1SchoolIdentity';
import { Step2OwnerAdmin } from './components/Step2OwnerAdmin';
import { Step3Campus } from './components/Step3Campus';
import { Step4Programs } from './components/Step4Programs';
import { Step5Curriculum } from './components/Step5Curriculum';
import { Step6Features } from './components/Step6Features';
import { Step7Fees, Step8RBAC, Step9Branding } from './components/OptionalSteps';
import { Step10Legal } from './components/Step10Legal';
import { Step11Checklist } from './components/Step11Checklist';

interface OnboardingStep {
    id: number;
    title: string;
    description: string;
    icon: any;
    required: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    { id: 1, title: "School Identity", description: "Basic school information", icon: Building2, required: true },
    { id: 2, title: "Owner & Admin", description: "Create super admin account", icon: UserPlus, required: true },
    { id: 3, title: "Campus Setup", description: "Add campus locations", icon: MapPin, required: false },
    { id: 4, title: "Academic Programs", description: "Configure programs & grades", icon: GraduationCap, required: true },
    { id: 5, title: "Curriculum", description: "Subject mapping", icon: BookOpen, required: false },
    { id: 6, title: "Features", description: "Enable modules", icon: Zap, required: true },
    { id: 7, title: "Fees & Payment", description: "Configure billing", icon: DollarSign, required: false },
    { id: 8, title: "Roles & Permissions", description: "RBAC setup", icon: Shield, required: false },
    { id: 9, title: "Branding", description: "Theme & communication", icon: Palette, required: false },
    { id: 10, title: "Legal & Compliance", description: "Registration & agreements", icon: FileCheck, required: true },
    { id: 11, title: "Go-Live Checklist", description: "Final review", icon: CheckCircle2, required: true },
];

export default function OnboardingWizard() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Onboarding data
    const [schoolId, setSchoolId] = useState('');
    const [campusId, setCampusId] = useState('');
    const [programId, setProgramId] = useState('');

    // Progress tracking
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);

    // Load saved data from localStorage on mount
    useEffect(() => {
        const savedSchoolId = localStorage.getItem('onboarding_school_id');
        const savedCampusId = localStorage.getItem('onboarding_campus_id');
        const savedProgramId = localStorage.getItem('onboarding_program_id');
        const savedStep = localStorage.getItem('onboarding_current_step');
        const savedCompleted = localStorage.getItem('onboarding_completed_steps');

        if (savedSchoolId) setSchoolId(savedSchoolId);
        if (savedCampusId) setCampusId(savedCampusId);
        if (savedProgramId) setProgramId(savedProgramId);
        if (savedStep) setCurrentStep(parseInt(savedStep));
        if (savedCompleted) setCompletedSteps(JSON.parse(savedCompleted));
    }, []);

    // Save data to localStorage whenever it changes
    useEffect(() => {
        if (schoolId) localStorage.setItem('onboarding_school_id', schoolId);
        if (campusId) localStorage.setItem('onboarding_campus_id', campusId);
        if (programId) localStorage.setItem('onboarding_program_id', programId);
        localStorage.setItem('onboarding_current_step', currentStep.toString());
        localStorage.setItem('onboarding_completed_steps', JSON.stringify(completedSteps));
    }, [schoolId, campusId, programId, currentStep, completedSteps]);

    const currentStepData = ONBOARDING_STEPS[currentStep - 1];
    const progress = (completedSteps.length / ONBOARDING_STEPS.length) * 100;

    const handleNext = () => {
        if (currentStep < ONBOARDING_STEPS.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSkip = () => {
        if (!currentStepData.required) {
            markStepComplete(currentStep);
            handleNext();
        }
    };

    const markStepComplete = (step: number) => {
        if (!completedSteps.includes(step)) {
            setCompletedSteps([...completedSteps, step]);
        }
    };

    const clearOnboardingData = () => {
        localStorage.removeItem('onboarding_school_id');
        localStorage.removeItem('onboarding_campus_id');
        localStorage.removeItem('onboarding_program_id');
        localStorage.removeItem('onboarding_current_step');
        localStorage.removeItem('onboarding_completed_steps');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => {
                                if (confirm('Are you sure you want to cancel onboarding? Progress will not be saved.')) {
                                    clearOnboardingData();
                                    router.push('/owner');
                                }
                            }}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                        >
                            ← Back to Dashboard
                        </button>
                        <div className="flex-1" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">School Onboarding Wizard</h1>
                    <p className="text-gray-600">Complete setup in 11 simple steps</p>
                </div>

                {/* Progress Bar */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-gray-700">
                            Step {currentStep} of {ONBOARDING_STEPS.length}
                        </span>
                        <span className="text-sm font-medium text-blue-600">
                            {Math.round(progress)}% Complete
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Steps Navigation */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div className="grid grid-cols-11 gap-2">
                        {ONBOARDING_STEPS.map((step) => {
                            const Icon = step.icon;
                            const isActive = currentStep === step.id;
                            const isCompleted = completedSteps.includes(step.id);

                            return (
                                <button
                                    key={step.id}
                                    onClick={() => setCurrentStep(step.id)}
                                    className={`flex flex-col items-center p-3 rounded-lg transition-all ${isActive
                                        ? 'bg-blue-100 border-2 border-blue-500'
                                        : isCompleted
                                            ? 'bg-green-50 border-2 border-green-500'
                                            : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <Icon className={`h-6 w-6 mb-1 ${isActive
                                        ? 'text-blue-600'
                                        : isCompleted
                                            ? 'text-green-600'
                                            : 'text-gray-400'
                                        }`} />
                                    <span className={`text-xs font-medium ${isActive
                                        ? 'text-blue-900'
                                        : isCompleted
                                            ? 'text-green-900'
                                            : 'text-gray-500'
                                        }`}>
                                        {step.id}
                                    </span>
                                    {step.required && (
                                        <span className="text-red-500 text-xs">*</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className={`p-4 rounded-xl ${currentStepData.required ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                            <currentStepData.icon className={`h-8 w-8 ${currentStepData.required ? 'text-blue-600' : 'text-gray-600'
                                }`} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {currentStepData.title}
                                {currentStepData.required && (
                                    <span className="text-red-500 ml-2">*</span>
                                )}
                            </h2>
                            <p className="text-gray-600">{currentStepData.description}</p>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    {/* Step Content */}
                    <div className="min-h-[400px]">
                        {currentStep === 1 && (
                            <Step1SchoolIdentity
                                onComplete={(id) => {
                                    setSchoolId(id);
                                    markStepComplete(1);
                                    handleNext();
                                }}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 2 && (
                            <Step2OwnerAdmin
                                schoolId={schoolId}
                                onComplete={() => {
                                    markStepComplete(2);
                                    handleNext();
                                }}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 3 && (
                            <Step3Campus
                                schoolId={schoolId}
                                onComplete={(id) => {
                                    setCampusId(id);
                                    markStepComplete(3);
                                    handleNext();
                                }}
                                onSkip={handleSkip}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 4 && (
                            <Step4Programs
                                schoolId={schoolId}
                                campusId={campusId}
                                onComplete={(id) => {
                                    setProgramId(id);
                                    markStepComplete(4);
                                    handleNext();
                                }}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 5 && (
                            <Step5Curriculum
                                programId={programId}
                                onComplete={() => {
                                    markStepComplete(5);
                                    handleNext();
                                }}
                                onSkip={handleSkip}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 6 && (
                            <Step6Features
                                schoolId={schoolId}
                                onComplete={() => {
                                    markStepComplete(6);
                                    handleNext();
                                }}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 7 && (
                            <Step7Fees
                                schoolId={schoolId}
                                onComplete={() => {
                                    markStepComplete(7);
                                    handleNext();
                                }}
                                onSkip={handleSkip}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 8 && (
                            <Step8RBAC
                                schoolId={schoolId}
                                onComplete={() => {
                                    markStepComplete(8);
                                    handleNext();
                                }}
                                onSkip={handleSkip}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 9 && (
                            <Step9Branding
                                schoolId={schoolId}
                                onComplete={() => {
                                    markStepComplete(9);
                                    handleNext();
                                }}
                                onSkip={handleSkip}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 10 && (
                            <Step10Legal
                                schoolId={schoolId}
                                onComplete={() => {
                                    markStepComplete(10);
                                    handleNext();
                                }}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                        {currentStep === 11 && (
                            <Step11Checklist
                                schoolId={schoolId}
                                onComplete={() => {
                                    markStepComplete(11);
                                    clearOnboardingData();
                                    router.push('/owner');
                                }}
                                setLoading={setLoading}
                                setError={setError}
                            />
                        )}
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={currentStep === 1 || loading}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back
                    </button>

                    <div className="flex items-center gap-3">
                        {!currentStepData.required && currentStep < 11 && (
                            <button
                                onClick={handleSkip}
                                disabled={loading}
                                className="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Skip (Optional)
                            </button>
                        )}

                        {loading && (
                            <div className="flex items-center gap-2 text-blue-600">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Processing...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
