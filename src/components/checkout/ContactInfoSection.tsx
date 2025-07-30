"use client";

import React from "react";
import { InputField } from "@/components/forms/InputField";
import { checkoutConfig } from "@/config/checkout";
import type { FormData, FormErrors } from "@/types/checkout";

interface ContactInfoSectionProps {
  formData: FormData;
  errors: FormErrors;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({
  formData,
  errors,
  onChange,
  onBlur
}) => {
  return (
    <div className="space-y-4">
      <h3 
        className="text-lg font-semibold border-b border-gray-200 pb-2" 
        style={{ color: checkoutConfig.ui.primaryColor }}
      >
        Contact Information
      </h3>
      <InputField
        label="Email Address"
        name="email"
        type="email"
        value={formData.email}
        onChange={onChange}
        onBlur={onBlur}
        error={errors.email}
      />
    </div>
  );
};