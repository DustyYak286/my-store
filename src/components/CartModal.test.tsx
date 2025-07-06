import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CartModal from './CartModal';

// Mock the useCart hook directly
const mockCartContext = {
  cartItems: [],
  cartCount: 0,
  totalPrice: 0,
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateItemQuantity: jest.fn(),
  clearCart: jest.fn(),
};

// Mock the useCart hook
jest.mock('../context/CartContext', () => ({
  useCart: () => mockCartContext,
}));

const renderCartModal = (open = true, onClose = jest.fn()) => {
  return render(
    <CartModal open={open} onClose={onClose} />
  );
};

describe('CartModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock context to empty state
    mockCartContext.cartItems = [];
    mockCartContext.cartCount = 0;
    mockCartContext.totalPrice = 0;
  });

  describe('Modal Visibility', () => {
    it('should not render when open is false', () => {
      renderCartModal(false);
      expect(screen.queryByText('Your Cart')).not.toBeInTheDocument();
    });

    it('should render when open is true', () => {
      renderCartModal(true);
      expect(screen.getByText('Your Cart')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      const mockOnClose = jest.fn();
      renderCartModal(true, mockOnClose);
      
      const closeButton = screen.getByLabelText('Close cart');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty Cart State', () => {
    it('should display empty cart message when cart is empty', () => {
      renderCartModal();
      
      expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
      expect(screen.getByText('Continue Shopping')).toBeInTheDocument();
      expect(screen.queryByText('Checkout (Coming Soon)')).not.toBeInTheDocument();
    });

    it('should show cart title without item count when empty', () => {
      renderCartModal();
      
      expect(screen.getByText('Your Cart')).toBeInTheDocument();
      expect(screen.queryByText(/\(\d+ items\)/)).not.toBeInTheDocument();
    });
  });

  describe('Cart with Items', () => {
    beforeEach(() => {
      mockCartContext.cartItems = [
        {
          id: 'item-1',
          name: 'Test Product 1',
          price: {
            original: 39.99,
            discount: 29.99,
            currency: 'USD'
          },
          image: '/test-image-1.jpg',
          quantity: 2
        },
        {
          id: 'item-2',
          name: 'Test Product 2',
          price: {
            original: 15.50,
            currency: 'USD'
          },
          image: '/test-image-2.jpg',
          quantity: 1
        }
      ];
      mockCartContext.cartCount = 3;
      mockCartContext.totalPrice = 75.48; // (29.99 * 2) + (15.50 * 1)
    });

    it('should display cart title with item count', () => {
      renderCartModal();
      
      expect(screen.getByText('Your Cart (3 items)')).toBeInTheDocument();
    });

    it('should display all cart items with correct information', () => {
      renderCartModal();
      
      // Check first item
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      expect(screen.getByText('$29.99')).toBeInTheDocument();
      expect(screen.getByText('$59.98')).toBeInTheDocument(); // 29.99 * 2
      
      // Check second item
      expect(screen.getByText('Test Product 2')).toBeInTheDocument();
      expect(screen.getAllByText('$15.50')).toHaveLength(2); // unit price and total price
      
      // Check images
      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute('src', '/test-image-1.jpg');
      expect(images[0]).toHaveAttribute('alt', 'Test Product 1');
      expect(images[1]).toHaveAttribute('src', '/test-image-2.jpg');
      expect(images[1]).toHaveAttribute('alt', 'Test Product 2');
    });

    it('should display quantity controls for each item', () => {
      renderCartModal();
      
      // Check quantity displays
      expect(screen.getByText('2')).toBeInTheDocument(); // quantity for item 1
      expect(screen.getByText('1')).toBeInTheDocument(); // quantity for item 2
      
      // Check plus/minus buttons exist
      const decreaseButtons = screen.getAllByLabelText('Decrease quantity');
      const increaseButtons = screen.getAllByLabelText('Increase quantity');
      expect(decreaseButtons).toHaveLength(2);
      expect(increaseButtons).toHaveLength(2);
    });

    it('should display remove buttons for each item', () => {
      renderCartModal();
      
      const removeButtons = screen.getAllByLabelText('Remove item');
      expect(removeButtons).toHaveLength(2);
    });

    it('should display subtotal and total correctly', () => {
      renderCartModal();
      
      expect(screen.getByText('Subtotal (3 items):')).toBeInTheDocument();
      expect(screen.getByText('Total:')).toBeInTheDocument();
      expect(screen.getAllByText('$75.48')).toHaveLength(1); // just the total
    });

    it('should display both checkout and continue shopping buttons', () => {
      renderCartModal();
      
      expect(screen.getByText('Checkout (Coming Soon)')).toBeInTheDocument();
      expect(screen.getByText('Continue Shopping')).toBeInTheDocument();
    });

    it('should have disabled checkout button', () => {
      renderCartModal();
      
      const checkoutButton = screen.getByText('Checkout (Coming Soon)');
      expect(checkoutButton).toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      mockCartContext.cartItems = [
        {
          id: 'test-item',
          name: 'Test Product',
          price: {
            original: 25.00,
            discount: 20.00,
            currency: 'USD'
          },
          image: '/test-image.jpg',
          quantity: 3
        }
      ];
      mockCartContext.cartCount = 3;
      mockCartContext.totalPrice = 60.00;
    });

    it('should call updateItemQuantity when increase button is clicked', () => {
      renderCartModal();
      
      const increaseButton = screen.getByLabelText('Increase quantity');
      fireEvent.click(increaseButton);
      
      expect(mockCartContext.updateItemQuantity).toHaveBeenCalledWith('test-item', 4);
    });

    it('should call updateItemQuantity when decrease button is clicked', () => {
      renderCartModal();
      
      const decreaseButton = screen.getByLabelText('Decrease quantity');
      fireEvent.click(decreaseButton);
      
      expect(mockCartContext.updateItemQuantity).toHaveBeenCalledWith('test-item', 2);
    });

    it('should call removeFromCart when remove button is clicked', () => {
      renderCartModal();
      
      const removeButton = screen.getByLabelText('Remove item');
      fireEvent.click(removeButton);
      
      expect(mockCartContext.removeFromCart).toHaveBeenCalledWith('test-item');
    });

    it('should call onClose when Continue Shopping button is clicked', () => {
      const mockOnClose = jest.fn();
      renderCartModal(true, mockOnClose);
      
      const continueButton = screen.getByText('Continue Shopping');
      fireEvent.click(continueButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Price Calculations', () => {
    it('should display correct item totals', () => {
      mockCartContext.cartItems = [
        {
          id: 'item-1',
          name: 'Product 1',
          price: {
            original: 12.50,
            currency: 'USD'
          },
          image: '/img1.jpg',
          quantity: 3
        }
      ];
      mockCartContext.cartCount = 3;
      mockCartContext.totalPrice = 37.50;
      
      renderCartModal();
      
      expect(screen.getAllByText('$37.50')).toHaveLength(3); // item total, subtotal, and final total (no discount)
    });

    it('should handle decimal prices correctly', () => {
      mockCartContext.cartItems = [
        {
          id: 'item-1',
          name: 'Product 1',
          price: {
            original: 9.99,
            currency: 'USD'
          },
          image: '/img1.jpg',
          quantity: 2
        }
      ];
      mockCartContext.cartCount = 2;
      mockCartContext.totalPrice = 19.98;
      
      renderCartModal();
      
      expect(screen.getAllByText('$19.98')).toHaveLength(3); // item total, subtotal, and final total (no discount)
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      mockCartContext.cartItems = [
        {
          id: 'test-item',
          name: 'Test Product',
          price: {
            original: 10.00,
            currency: 'USD'
          },
          image: '/test.jpg',
          quantity: 1
        }
      ];
      
      renderCartModal();
      
      expect(screen.getByLabelText('Close cart')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase quantity')).toBeInTheDocument();
      expect(screen.getByLabelText('Decrease quantity')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove item')).toBeInTheDocument();
    });

    it('should have proper alt text for product images', () => {
      mockCartContext.cartItems = [
        {
          id: 'test-item',
          name: 'Test Product Name',
          price: {
            original: 10.00,
            currency: 'USD'
          },
          image: '/test.jpg',
          quantity: 1
        }
      ];
      
      renderCartModal();
      
      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', 'Test Product Name');
    });
  });

  describe('Enhanced Discount Display', () => {
    beforeEach(() => {
      mockCartContext.cartItems = [
        {
          id: 'discounted-item',
          name: 'Discounted Product',
          price: {
            original: 14.99,
            discount: 9.99,
            currency: 'USD'
          },
          image: '/test-image.jpg',
          quantity: 2
        }
      ];
      mockCartContext.cartCount = 2;
      mockCartContext.totalPrice = 19.98; // 9.99 * 2
    });

    it('should display discounted price, original price, and percentage off', () => {
      renderCartModal();
      
      // Should show discounted price
      expect(screen.getByText('$9.99')).toBeInTheDocument();
      
      // Should show original price with strikethrough
      expect(screen.getByText('$14.99')).toBeInTheDocument();
      
      // Should show percentage off badge
      expect(screen.getByText('33% OFF')).toBeInTheDocument();
    });

    it('should display comprehensive totals breakdown', () => {
      renderCartModal();
      
      // Should show subtotal (original prices)
      expect(screen.getByText('Subtotal (2 items):')).toBeInTheDocument();
      expect(screen.getByText('$29.98')).toBeInTheDocument(); // 14.99 * 2
      
      // Should show discount savings
      expect(screen.getByText('Discount savings:')).toBeInTheDocument();
      expect(screen.getByText('−$10.00')).toBeInTheDocument(); // (14.99 - 9.99) * 2
      
      // Should show final total
      expect(screen.getByText('Total:')).toBeInTheDocument();
      expect(screen.getAllByText('$19.98')).toHaveLength(2); // item total and final total
    });
  });
}); 