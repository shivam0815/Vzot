import React from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps {
  label: string;
  field: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.ComponentType<any>;
  half?: boolean;
  errors: Record<string, string>;
}

const Input: React.FC<InputProps> = ({
  label,
  field,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  icon: Icon,
  half = false,
  errors,
}) => (
  <div className={half ? 'flex-1 min-w-0' : 'w-full'}>
    <label className="block text-sm font-semibold text-gray-800 mb-2">
      {label}
    </label>

    <div className="relative">
      {Icon && (
        <Icon
          className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
        />
      )}

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base ${
          Icon ? 'pl-9 sm:pl-10' : ''
        } border-2 rounded-xl
        bg-gray-50 focus:bg-white
        text-gray-900 placeholder:text-gray-400
        caret-blue-500
        focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500
        transition-all duration-200
        ${
          errors[field]
            ? 'border-red-400 bg-red-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      />

      {errors[field] && (
        <div className="flex items-center mt-2 text-red-600">
          <AlertCircle className="h-4 w-4 mr-1" />
          <span className="text-sm">{errors[field]}</span>
        </div>
      )}
    </div>
  </div>
);

export default Input;
