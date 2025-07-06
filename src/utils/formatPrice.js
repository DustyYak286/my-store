export const formatPrice = (price) => {
  if (typeof price !== 'number') {
    return '0.00';
  }
  return price.toFixed(2);
};
