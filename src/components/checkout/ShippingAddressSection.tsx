"use client";

import React from "react";
import { InputField } from "@/components/forms/InputField";
import { SelectField } from "@/components/forms/SelectField";
import { checkoutConfig } from "@/config/checkout";
import type { FormData, FormErrors } from "@/types/checkout";

interface ShippingAddressSectionProps {
  formData: FormData;
  errors: FormErrors;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  countries: string[];
}

export const ShippingAddressSection: React.FC<ShippingAddressSectionProps> = ({
  formData,
  errors,
  onChange,
  onBlur,
  countries
}) => {
  return (
    <div className="space-y-4">
      <h3 
        className="text-lg font-semibold border-b border-gray-200 pb-2" 
        style={{ color: checkoutConfig.ui.primaryColor }}
      >
        Shipping Address
      </h3>
      
      <InputField
        label="Full Name"
        name="shippingFullName"
        value={formData.shippingFullName}
        onChange={onChange}
        onBlur={onBlur}
        error={errors.shippingFullName}
      />
      
      <InputField
        label="Street Address"
        name="shippingStreetAddress"
        value={formData.shippingStreetAddress}
        onChange={onChange}
        onBlur={onBlur}
        error={errors.shippingStreetAddress}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          label="City"
          name="shippingCity"
          value={formData.shippingCity}
          onChange={onChange}
          onBlur={onBlur}
          error={errors.shippingCity}
        />
        <InputField
          label="Postal Code"
          name="shippingPostalCode"
          value={formData.shippingPostalCode}
          onChange={onChange}
          onBlur={onBlur}
          error={errors.shippingPostalCode}
        />
      </div>
      
      <SelectField
        label="Country"
        name="shippingCountry"
        value={formData.shippingCountry}
        onChange={onChange}
        onBlur={onBlur}
        options={countries}
        error={errors.shippingCountry}
      />
    </div>
  );
};