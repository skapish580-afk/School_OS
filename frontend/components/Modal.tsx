import { X, Loader2 } from 'lucide-react';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'date';
  required?: boolean;
  maxLength?: number;
  min?: number;
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
}

interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  fields?: FormField[];
  onSubmit?: (formData: Record<string, string | number | boolean>) => Promise<void>;
  loading?: boolean;
  error?: string;
  formData?: Record<string, string | number | boolean>;
  onFormChange?: (field: string, value: string | number | boolean) => void;
  submitButtonText?: string;
  submitLabel?: string; // Alternative name
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'indigo';
  children?: React.ReactNode;
}

const colorStyles = {
  blue: 'focus:ring-blue-500 hover:bg-blue-50 bg-blue-600 hover:bg-blue-700',
  purple: 'focus:ring-purple-500 hover:bg-purple-50 bg-purple-600 hover:bg-purple-700',
  green: 'focus:ring-green-500 hover:bg-green-50 bg-green-600 hover:bg-green-700',
  orange: 'focus:ring-orange-500 hover:bg-orange-50 bg-orange-600 hover:bg-orange-700',
  red: 'focus:ring-red-500 hover:bg-red-50 bg-red-600 hover:bg-red-700',
  indigo: 'focus:ring-indigo-500 hover:bg-indigo-50 bg-indigo-600 hover:bg-indigo-700',
};

export default function Modal({
  isOpen = true,
  onClose,
  title,
  fields,
  onSubmit,
  loading = false,
  error = '',
  formData = {},
  onFormChange,
  submitButtonText = 'Create',
  submitLabel,
  color = 'blue',
  children,
}: ModalProps) {
  const buttonText = submitLabel || submitButtonText;
  if (!isOpen) return null;

  // If children are provided, render custom content
  if (children) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
          <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true"></div>
          <div
            className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      await onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields?.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>

              {field.type === 'select' ? (
                <select
                  value={(formData[field.name] as string) || ''}
                  onChange={(e) => onFormChange?.(field.name, e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 ${colorStyles[color].split(' ')[0]}`}
                  required={field.required}
                >
                  <option value="">Select {field.label}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={(formData[field.name] as string) || ''}
                  onChange={(e) => onFormChange?.(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 ${colorStyles[color].split(' ')[0]} resize-none`}
                  rows={3}
                  required={field.required}
                />
              ) : field.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={!!formData[field.name]}
                  onChange={(e) => onFormChange?.(field.name, e.target.checked)}
                  className={`w-4 h-4 border border-gray-300 bg-white text-gray-900 rounded focus:outline-none focus:ring-2 ${colorStyles[color].split(' ')[0]}`}
                />
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={(formData[field.name] as number) || ''}
                  onChange={(e) => onFormChange?.(field.name, e.target.value ? parseFloat(e.target.value) : '')}
                  placeholder={field.placeholder}
                  min={field.min}
                  className={`w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 ${colorStyles[color].split(' ')[0]}`}
                  required={field.required}
                />
              ) : (
                <input
                  type={field.type}
                  value={(formData[field.name] as string) || ''}
                  onChange={(e) => onFormChange?.(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  className={`w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 ${colorStyles[color].split(' ')[0]}`}
                  required={field.required}
                />
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition font-medium disabled:bg-gray-400 ${colorStyles[color]}`}
            >
              {loading ? <Loader2 className="inline animate-spin mr-2" size={16} /> : (submitLabel || submitButtonText)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
