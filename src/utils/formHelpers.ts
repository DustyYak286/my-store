/**
 * Form utility functions for autocomplete and field helpers
 */

/**
 * Get appropriate autocomplete value for form fields
 * Follows HTML5 autocomplete specification for better UX
 */
export const getAutoCompleteValue = (fieldName: string): string => {
  const autoCompleteMap: Record<string, string> = {
    email: 'email',
    shippingFullName: 'shipping name',
    billingFullName: 'billing name',
    shippingStreetAddress: 'shipping street-address',
    billingStreetAddress: 'billing street-address',
    shippingCity: 'shipping address-level2',
    billingCity: 'billing address-level2',
    shippingPostalCode: 'shipping postal-code',
    billingPostalCode: 'billing postal-code',
    shippingCountry: 'shipping country',
    billingCountry: 'billing country'
  };
  return autoCompleteMap[fieldName] || 'off';
};