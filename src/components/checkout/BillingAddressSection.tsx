"use client";

import React from "react";
import { InputField } from "@/components/forms/InputField";
import { SelectField } from "@/components/forms/SelectField";
import { checkoutConfig } from "@/config/checkout";
import type { FormData, FormErrors } from "@/types/checkout";

interface BillingAddressSectionProps {
  formData: FormData;
  errors: FormErrors;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSameAsShippingChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  countries: string[];
}

export const BillingAddressSection: React.FC<BillingAddressSectionProps> = ({
  formData,
  errors,
  onChange,
  onBlur,
  onSameAsShippingChange,
  countries
}) => {
  return (
    <div className="space-y-4">
      <h3 
        className="text-lg font-semibold border-b border-gray-200 pb-2" 
        style={{ color: checkoutConfig.ui.primaryColor }}
      >
        Billing Address
      </h3>
      
      {/* Same as shipping checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="sameAsShipping"
          name="sameAsShipping"
          checked={formData.sameAsShipping}
          onChange={onSameAsShippingChange}
          className="h-4 w-4 rounded border-gray-300 focus:ring-2 focus:ring-offset-2"
          style={{ '--tw-ring-color': checkoutConfig.ui.primaryColor } as React.CSSProperties}
        />
        <label htmlFor="sameAsShipping" className="ml-2 text-sm font-medium text-gray-700">
          Same as shipping address
        </label>
      </div>

      {/* Billing address fields - only show if not same as shipping */}
      {!formData.sameAsShipping && checkoutConfig.features.billingAddressSection && (
        <>
          <InputField
            label="Full Name"
            name="billingFullName"
            value={formData.billingFullName}
            onChange={onChange}
            onBlur={onBlur}
            error={errors.billingFullName}
          />
          
          <InputField
            label="Street Address"
            name="billingStreetAddress"
            value={formData.billingStreetAddress}
            onChange={onChange}
            onBlur={onBlur}
            error={errors.billingStreetAddress}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="City"
              name="billingCity"
              value={formData.billingCity}
              onChange={onChange}
              onBlur={onBlur}
              error={errors.billingCity}
            />
            <InputField
              label="Postal Code"
              name="billingPostalCode"
              value={formData.billingPostalCode}
              onChange={onChange}
              onBlur={onBlur}
              error={errors.billingPostalCode}
            />
          </div>
          
          <SelectField
            label="Country"
            name="billingCountry"
            value={formData.billingCountry}
            onChange={onChange}
            onBlur={onBlur}
            options={countries}
            error={errors.billingCountry}
          />
        </>
      )}
    </div>
  );
};