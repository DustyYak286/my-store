export const formatPrice = (price: number): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return '0.00';
  }
  return price.toFixed(2);
};
