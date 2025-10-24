"use client";

import React from "react";
import { checkoutConfig } from "@/config/checkout";
import { getAutoCompleteValue } from "@/utils/formHelpers";

export interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string | undefined;
  required?: boolean | undefined;
}

export const SelectField: React.FC<SelectFieldProps> = ({ 
  label, 
  name, 
  value, 
  onChange, 
  onBlur,
  options, 
  error, 
  required = true 
}) => {
  const fieldId = `field-${name}`;
  const errorId = `error-${name}`;
  
  return (
    <div className="space-y-1">
      <label 
        htmlFor={fieldId} 
        className="block text-sm font-medium" 
        style={{ color: checkoutConfig.ui.primaryColor }}
      >
        {label} {required && <span className="text-red-500" aria-label="required">*</span>}
      </label>
      <select
        id={fieldId}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
          error 
            ? "border-red-500 focus:ring-red-500" 
            : "border-gray-300 hover:border-gray-400"
        }`}
        style={
          !error 
            ? { '--tw-ring-color': checkoutConfig.ui.primaryColor } as React.CSSProperties
            : undefined
        }
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : "false"}
        autoComplete={getAutoCompleteValue(name)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-red-500 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};