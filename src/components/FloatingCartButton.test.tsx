import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FloatingCartButton from './FloatingCartButton';
import { useCart } from '@/context/CartContext';
import { useCartModal } from '@/context/CartModalContext';
import { useFloatingCartVisibility } from '@/hooks/useFloatingCartVisibility';

// Mock the useCart hook
jest.mock('@/context/CartContext', () => ({
  useCart: jest.fn(),
}));

// Mock the useCartModal hook
jest.mock('@/context/CartModalContext', () => ({
  useCartModal: jest.fn(),
}));

// Mock the useFloatingCartVisibility hook
jest.mock('@/hooks/useFloatingCartVisibility', () => ({
  useFloatingCartVisibility: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const mockUseCart = useCart as jest.MockedFunction<typeof useCart>;
const mockUseCartModal = useCartModal as jest.MockedFunction<typeof useCartModal>;
const mockUseFloatingCartVisibility = useFloatingCartVisibility as jest.MockedFunction<typeof useFloatingCartVisibility>;

describe('FloatingCartButton', () => {
  const mockNavbarRef = { current: document.createElement('nav') };
  const mockOpenCart = jest.fn();

  beforeEach(() => {
    // Default mock implementations
    mockUseCart.mockReturnValue({
      cartCount: 0,
      cartItems: [],
      totalPrice: 0,
      addToCart: jest.fn(),
      removeFromCart: jest.fn(),
      updateItemQuantity: jest.fn(),
      clearCart: jest.fn(),
    });

    mockUseCartModal.mockReturnValue({
      isCartOpen: false,
      openCart: mockOpenCart,
      closeCart: jest.fn(),
    });

    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: false,
      isNavbarVisible: true,
      isCheckoutPage: false,
    });

    jest.clearAllMocks();
  });

  it('should be hidden when the Navbar is visible', () => {
    // Mock button as hidden (navbar visible)
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: false,
      isNavbarVisible: true,
      isCheckoutPage: false,
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    const button = screen.getByRole('button', { name: 'Open cart' });
    
    // Button should have opacity-0 class when navbar is visible
    expect(button).toHaveClass('opacity-0');
    expect(button).toHaveClass('pointer-events-none');
  });

  it('should be visible when the Navbar is not visible', () => {
    // Mock button as visible (navbar not visible, not checkout page)
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: true,
      isNavbarVisible: false,
      isCheckoutPage: false,
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    const button = screen.getByRole('button', { name: 'Open cart' });
    
    // Button should have opacity-100 class when navbar is not visible
    expect(button).toHaveClass('opacity-100');
    expect(button).not.toHaveClass('pointer-events-none');
  });

  it('should trigger openCart function when clicked', () => {
    // Mock button as visible so it's clickable
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: true,
      isNavbarVisible: false,
      isCheckoutPage: false,
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    const button = screen.getByRole('button', { name: 'Open cart' });
    
    // Click the button
    fireEvent.click(button);
    
    // Verify openCart was called
    expect(mockOpenCart).toHaveBeenCalledTimes(1);
  });

  it('should display the correct cart item count in the badge', () => {
    // Mock button as visible
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: true,
      isNavbarVisible: false,
      isCheckoutPage: false,
    });

    // Mock cart with items
    mockUseCart.mockReturnValue({
      cartCount: 3,
      cartItems: [],
      totalPrice: 0,
      addToCart: jest.fn(),
      removeFromCart: jest.fn(),
      updateItemQuantity: jest.fn(),
      clearCart: jest.fn(),
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    // Verify the badge displays the correct count
    const badge = screen.getByText('3');
    expect(badge).toBeInTheDocument();
  });

  it('should not display badge when cart is empty', () => {
    // Mock button as visible
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: true,
      isNavbarVisible: false,
      isCheckoutPage: false,
    });

    // Mock empty cart
    mockUseCart.mockReturnValue({
      cartCount: 0,
      cartItems: [],
      totalPrice: 0,
      addToCart: jest.fn(),
      removeFromCart: jest.fn(),
      updateItemQuantity: jest.fn(),
      clearCart: jest.fn(),
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    // Verify no badge is displayed when cart is empty
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('should be hidden on checkout page even when navbar is not visible', () => {
    // Mock button as hidden due to checkout page
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: false,
      isNavbarVisible: false,
      isCheckoutPage: true,
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    const button = screen.getByRole('button', { name: 'Open cart' });
    
    // Button should be hidden on checkout page regardless of navbar visibility
    expect(button).toHaveClass('opacity-0');
    expect(button).toHaveClass('pointer-events-none');
  });

  it('should handle large cart counts correctly', () => {
    // Mock button as visible
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: true,
      isNavbarVisible: false,
      isCheckoutPage: false,
    });

    // Mock cart with many items
    mockUseCart.mockReturnValue({
      cartCount: 99,
      cartItems: [],
      totalPrice: 0,
      addToCart: jest.fn(),
      removeFromCart: jest.fn(),
      updateItemQuantity: jest.fn(),
      clearCart: jest.fn(),
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    // Verify the badge displays large numbers correctly
    const badge = screen.getByText('99');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('min-w-[18px]'); // Ensures badge can expand for larger numbers
  });

  it('should have proper accessibility attributes', () => {
    // Mock button as visible
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: true,
      isNavbarVisible: false,
      isCheckoutPage: false,
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    const button = screen.getByRole('button', { name: 'Open cart' });
    
    // Verify accessibility attributes
    expect(button).toHaveAttribute('aria-label', 'Open cart');
    // Button element is inherently type="button" when no form is present
    expect(button.tagName).toBe('BUTTON');
  });

  it('should have pointer-events-none when hidden', () => {
    // Mock button as hidden
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: false,
      isNavbarVisible: true,
      isCheckoutPage: false,
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    const button = screen.getByRole('button', { name: 'Open cart' });
    
    // Verify the button has pointer-events-none class when hidden
    expect(button).toHaveClass('pointer-events-none');
    expect(button).toHaveClass('opacity-0');
  });

  it('should handle different checkout paths correctly', () => {
    // Mock button as hidden due to checkout page
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: false,
      isNavbarVisible: false,
      isCheckoutPage: true,
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    const button = screen.getByRole('button', { name: 'Open cart' });
    
    // Button should be hidden on checkout page
    expect(button).toHaveClass('opacity-0');
    expect(button).toHaveClass('pointer-events-none');
  });

  it('should be visible on non-checkout pages', () => {
    // Mock button as visible (not checkout page, navbar not visible)
    mockUseFloatingCartVisibility.mockReturnValue({
      shouldShowButton: true,
      isNavbarVisible: false,
      isCheckoutPage: false,
    });

    render(<FloatingCartButton navbarRef={mockNavbarRef} />);

    const button = screen.getByRole('button', { name: 'Open cart' });
    
    // Button should be visible on regular pages
    expect(button).toHaveClass('opacity-100');
    expect(button).not.toHaveClass('pointer-events-none');
  });
}); 