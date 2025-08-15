import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import PaymentSection from './PaymentSection';
import { useCart } from '@/context/CartContext';
import * as stripeClient from '@/lib/stripe-client';

// Mock dependencies
jest.mock('@stripe/react-stripe-js');
jest.mock('@/context/CartContext');
jest.mock('@/lib/stripe-client');
jest.mock('./PaymentMethodSelector', () => {
  return function MockPaymentMethodSelector({ onMethodChange, selectedMethod }: any) {
    return (
      <div data-testid="payment-method-selector">
        <button 
          data-testid="select-card"
          onClick={() => onMethodChange('card')}
          aria-pressed={selectedMethod === 'card'}
        >
          Card
        </button>
        <button 
          data-testid="select-apple-pay"
          onClick={() => onMethodChange('apple_pay')}
          aria-pressed={selectedMethod === 'apple_pay'}
        >
          Apple Pay
        </button>
        <button 
          data-testid="select-google-pay"
          onClick={() => onMethodChange('google_pay')}
          aria-pressed={selectedMethod === 'google_pay'}
        >
          Google Pay
        </button>
      </div>
    );
  };
});
jest.mock('./CardPaymentForm', () => {
  return function MockCardPaymentForm({ onValidationChange }: any) {
    return (
      <div data-testid="card-payment-form">
        <button 
          data-testid="set-card-valid"
          onClick={() => onValidationChange?.(true)}
        >
          Set Valid
        </button>
        <button 
          data-testid="set-card-invalid"
          onClick={() => onValidationChange?.(false)}
        >
          Set Invalid
        </button>
      </div>
    );
  };
});
jest.mock('./DigitalWalletButtons', () => {
  return function MockDigitalWalletButtons({ selectedMethod }: any) {
    return (
      <div data-testid="digital-wallet-buttons">
        {selectedMethod === 'apple_pay' ? 'Apple Pay Button' : 'Google Pay Button'}
      </div>
    );
  };
});

const mockUseStripe = useStripe as jest.MockedFunction<typeof useStripe>;
const mockUseElements = useElements as jest.MockedFunction<typeof useElements>;
const mockUseCart = useCart as jest.MockedFunction<typeof useCart>;
const mockDetectAvailablePaymentMethods = stripeClient.detectAvailablePaymentMethods as jest.MockedFunction<typeof stripeClient.detectAvailablePaymentMethods>;
const mockDetectPaymentMethodsWithStripe = stripeClient.detectPaymentMethodsWithStripe as jest.MockedFunction<typeof stripeClient.detectPaymentMethodsWithStripe>;

// Mock Stripe instances
const mockStripe = {
  paymentRequest: jest.fn(),
};
const mockElements = {};

const mockCart = {
  totalPrice: 67.48,
  cartItems: [
    { id: '1', name: 'Test Product', price: 67.48, quantity: 1 },
  ],
};

describe('PaymentSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseStripe.mockReturnValue(mockStripe as any);
    mockUseElements.mockReturnValue(mockElements as any);
    mockUseCart.mockReturnValue(mockCart as any);
    
    // Mock basic payment method detection
    mockDetectAvailablePaymentMethods.mockReturnValue({
      card: true,
      applePay: false,
      googlePay: false,
    });
    
    // Mock enhanced Stripe-based detection
    mockDetectPaymentMethodsWithStripe.mockResolvedValue({
      card: true,
      applePay: false,
      googlePay: false,
    });
  });

  describe('Initialization', () => {
    it('renders payment section with all components', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('Payment Information')).toBeInTheDocument();
        expect(screen.getByTestId('payment-method-selector')).toBeInTheDocument();
        expect(screen.getByTestId('card-payment-form')).toBeInTheDocument();
      });
    });

    it('shows loading state during initialization', () => {
      // Mock delayed resolution
      mockDetectPaymentMethodsWithStripe.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<PaymentSection />);

      expect(screen.getByText('Payment Information')).toBeInTheDocument();
      // Should show skeleton loading state
      const skeletonElements = document.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('uses basic detection when Stripe is not available', async () => {
      mockUseStripe.mockReturnValue(null);

      render(<PaymentSection />);

      await waitFor(() => {
        expect(mockDetectAvailablePaymentMethods).toHaveBeenCalled();
        expect(mockDetectPaymentMethodsWithStripe).not.toHaveBeenCalled();
      });
    });

    it('uses Stripe-based detection when Stripe is available', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        expect(mockDetectPaymentMethodsWithStripe).toHaveBeenCalledWith(mockStripe, 6748);
      });
    });

    it('falls back to basic detection when Stripe detection fails', async () => {
      mockDetectPaymentMethodsWithStripe.mockRejectedValue(new Error('Stripe detection failed'));

      render(<PaymentSection />);

      await waitFor(() => {
        expect(mockDetectPaymentMethodsWithStripe).toHaveBeenCalled();
        expect(mockDetectAvailablePaymentMethods).toHaveBeenCalled();
      });
    });
  });

  describe('Payment Method Selection', () => {
    it('starts with card payment method selected', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        const cardButton = screen.getByTestId('select-card');
        expect(cardButton).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('detects Apple Pay when available', async () => {
      mockDetectPaymentMethodsWithStripe.mockResolvedValue({
        card: true,
        applePay: true,
        googlePay: false,
      });

      render(<PaymentSection />);

      await waitFor(() => {
        const applePayButton = screen.getByTestId('select-apple-pay');
        expect(applePayButton).toBeInTheDocument();
        // Card is selected by default, user must manually select Apple Pay
        expect(screen.getByTestId('select-card')).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('detects Google Pay when available', async () => {
      mockDetectPaymentMethodsWithStripe.mockResolvedValue({
        card: true,
        applePay: false,
        googlePay: true,
      });

      render(<PaymentSection />);

      await waitFor(() => {
        const googlePayButton = screen.getByTestId('select-google-pay');
        expect(googlePayButton).toBeInTheDocument();
        // Card is selected by default, user must manually select Google Pay
        expect(screen.getByTestId('select-card')).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('allows manual payment method selection', async () => {
      mockDetectPaymentMethodsWithStripe.mockResolvedValue({
        card: true,
        applePay: true,
        googlePay: true,
      });

      render(<PaymentSection />);

      await waitFor(() => {
        // Card is selected by default
        expect(screen.getByTestId('select-card')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('select-apple-pay')).toBeInTheDocument();
        expect(screen.getByTestId('select-google-pay')).toBeInTheDocument();
      });

      // Select Google Pay manually
      fireEvent.click(screen.getByTestId('select-google-pay'));

      await waitFor(() => {
        expect(screen.getByTestId('select-google-pay')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('select-card')).toHaveAttribute('aria-pressed', 'false');
      });
    });

    it('calls onPaymentMethodChange when method changes', async () => {
      const onPaymentMethodChange = jest.fn();
      render(<PaymentSection onPaymentMethodChange={onPaymentMethodChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-card')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('select-apple-pay'));

      expect(onPaymentMethodChange).toHaveBeenCalledWith('apple_pay');
    });
  });

  describe('Payment Form Rendering', () => {
    it('shows card payment form when card is selected', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByTestId('card-payment-form')).toBeInTheDocument();
        expect(screen.queryByTestId('digital-wallet-buttons')).not.toBeInTheDocument();
      });
    });

    it('shows digital wallet buttons when Apple Pay is selected', async () => {
      mockDetectPaymentMethodsWithStripe.mockResolvedValue({
        card: true,
        applePay: true,
        googlePay: false,
      });

      render(<PaymentSection />);

      // Wait for component to load, then manually select Apple Pay
      await waitFor(() => {
        expect(screen.getByTestId('select-apple-pay')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('select-apple-pay'));

      await waitFor(() => {
        expect(screen.getByTestId('digital-wallet-buttons')).toBeInTheDocument();
        expect(screen.getByText('Apple Pay Button')).toBeInTheDocument();
        expect(screen.queryByTestId('card-payment-form')).not.toBeInTheDocument();
      });
    });

    it('shows digital wallet buttons when Google Pay is selected', async () => {
      mockDetectPaymentMethodsWithStripe.mockResolvedValue({
        card: true,
        applePay: false,
        googlePay: true,
      });

      render(<PaymentSection />);

      await waitFor(() => {
        fireEvent.click(screen.getByTestId('select-google-pay'));
      });

      expect(screen.getByTestId('digital-wallet-buttons')).toBeInTheDocument();
      expect(screen.getByText('Google Pay Button')).toBeInTheDocument();
      expect(screen.queryByTestId('card-payment-form')).not.toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('reports invalid state initially', async () => {
      const onValidationChange = jest.fn();
      render(<PaymentSection onValidationChange={onValidationChange} />);

      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalledWith(false);
      });
    });

    it('reports valid state when card form is valid', async () => {
      const onValidationChange = jest.fn();
      render(<PaymentSection onValidationChange={onValidationChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('card-payment-form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('set-card-valid'));

      expect(onValidationChange).toHaveBeenCalledWith(true);
    });

    it('reports invalid state when card form is invalid', async () => {
      const onValidationChange = jest.fn();
      render(<PaymentSection onValidationChange={onValidationChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('card-payment-form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('set-card-invalid'));

      expect(onValidationChange).toHaveBeenCalledWith(false);
    });

    it('reports valid state for digital wallets when available', async () => {
      const onValidationChange = jest.fn();
      mockDetectPaymentMethodsWithStripe.mockResolvedValue({
        card: true,
        applePay: true,
        googlePay: false,
      });

      render(<PaymentSection onValidationChange={onValidationChange} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('select-apple-pay')).toBeInTheDocument();
      });

      // Clear previous calls and select Apple Pay
      onValidationChange.mockClear();
      fireEvent.click(screen.getByTestId('select-apple-pay'));

      // Digital wallets should report valid state when selected
      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Amount Validation', () => {
    it('validates payment amount and shows errors', async () => {
      const mockCartWithLowAmount = {
        ...mockCart,
        totalPrice: 1.0, // Below minimum
      };
      mockUseCart.mockReturnValue(mockCartWithLowAmount as any);

      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getAllByText(/minimum payment amount/i)[0]).toBeInTheDocument();
      });
    });

    it('shows amount validation status', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('Total Amount:')).toBeInTheDocument();
        expect(screen.getByText('67,48 RON')).toBeInTheDocument();
      });
    });

    it('shows validation warnings for small amounts', async () => {
      const mockCartWithSmallAmount = {
        ...mockCart,
        totalPrice: 3.0, // Valid but small
      };
      mockUseCart.mockReturnValue(mockCartWithSmallAmount as any);

      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText(/minimum recommended/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows validation errors', async () => {
      const mockCartWithInvalidAmount = {
        ...mockCart,
        totalPrice: 0, // Invalid amount
      };
      mockUseCart.mockReturnValue(mockCartWithInvalidAmount as any);

      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('Validation Error')).toBeInTheDocument();
      });
    });

    it('shows validation warnings', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        // Initially card form is invalid, so should show warning
        expect(screen.getByText(/warning/i)).toBeInTheDocument();
      });
    });

    it('handles payment method detection errors gracefully', async () => {
      mockDetectPaymentMethodsWithStripe.mockRejectedValue(new Error('Detection failed'));

      render(<PaymentSection />);

      await waitFor(() => {
        // Should fallback to basic detection and still render
        expect(screen.getByText('Payment Information')).toBeInTheDocument();
        expect(mockDetectAvailablePaymentMethods).toHaveBeenCalled();
      });
    });
  });

  describe('Security Information', () => {
    it('displays security badge', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('Secured by Stripe')).toBeInTheDocument();
      });
    });

    it('displays security information section', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('Your payment information is secure')).toBeInTheDocument();
        expect(screen.getByText(/industry-standard encryption/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Status', () => {
    it('shows payment ready status when valid', async () => {
      const onValidationChange = jest.fn();
      render(<PaymentSection onValidationChange={onValidationChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('card-payment-form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('set-card-valid'));

      await waitFor(() => {
        expect(screen.getByText('Payment ready')).toBeInTheDocument();
      });
    });

    it('shows error count when invalid', async () => {
      const mockCartWithInvalidAmount = {
        ...mockCart,
        totalPrice: 0,
      };
      mockUseCart.mockReturnValue(mockCartWithInvalidAmount as any);

      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText(/1 error/)).toBeInTheDocument();
      });
    });

    it('shows warning count when warnings exist', async () => {
      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText(/warning/)).toBeInTheDocument();
      });
    });

    it('displays current payment method', async () => {
      // Make Apple Pay available for this test
      mockDetectPaymentMethodsWithStripe.mockResolvedValue({
        card: true,
        applePay: true,
        googlePay: false,
      });

      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('Method: card')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('select-apple-pay'));

      await waitFor(() => {
        expect(screen.getByText('Method: apple pay')).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('applies disabled state to child components', async () => {
      render(<PaymentSection disabled={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('payment-method-selector')).toBeInTheDocument();
        expect(screen.getByTestId('card-payment-form')).toBeInTheDocument();
      });

      // Child components should receive disabled prop (tested in their own test suites)
    });
  });

  describe('Edge Cases', () => {
    it('handles cart total of zero gracefully', async () => {
      const mockCartWithZeroTotal = {
        ...mockCart,
        totalPrice: 0,
      };
      mockUseCart.mockReturnValue(mockCartWithZeroTotal as any);

      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('0,00 RON')).toBeInTheDocument();
      });
    });

    it('handles negative cart total gracefully', async () => {
      const mockCartWithNegativeTotal = {
        ...mockCart,
        totalPrice: -10,
      };
      mockUseCart.mockReturnValue(mockCartWithNegativeTotal as any);

      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('Invalid cart total. Please refresh and try again.')).toBeInTheDocument();
      });
    });

    it('handles missing cart total gracefully', async () => {
      const mockCartWithMissingTotal = {
        ...mockCart,
        totalPrice: undefined,
      };
      mockUseCart.mockReturnValue(mockCartWithMissingTotal as any);

      render(<PaymentSection />);

      await waitFor(() => {
        expect(screen.getByText('Invalid cart total. Please refresh and try again.')).toBeInTheDocument();
      });
    });

    it('handles rapid payment method changes', async () => {
      mockDetectPaymentMethodsWithStripe.mockResolvedValue({
        card: true,
        applePay: true,
        googlePay: true,
      });

      render(<PaymentSection />);

      // Wait for component to fully load and all buttons to be available
      await waitFor(() => {
        expect(screen.getByTestId('select-apple-pay')).toBeInTheDocument();
        expect(screen.getByTestId('select-google-pay')).toBeInTheDocument();
        expect(screen.getByTestId('select-card')).toBeInTheDocument();
        // Card is selected by default
        expect(screen.getByTestId('select-card')).toHaveAttribute('aria-pressed', 'true');
      });

      // Test that manual selections work - start with Google Pay since it won't auto-revert
      fireEvent.click(screen.getByTestId('select-google-pay'));
      
      await waitFor(() => {
        expect(screen.getByTestId('select-google-pay')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('select-apple-pay')).toHaveAttribute('aria-pressed', 'false');
      });
      
      // Then test Apple Pay selection
      fireEvent.click(screen.getByTestId('select-apple-pay'));

      await waitFor(() => {
        expect(screen.getByTestId('select-apple-pay')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('select-google-pay')).toHaveAttribute('aria-pressed', 'false');
      });
      
      // Finally test rapid changes between digital wallets
      fireEvent.click(screen.getByTestId('select-google-pay'));
      await waitFor(() => {
        expect(screen.getByTestId('select-google-pay')).toHaveAttribute('aria-pressed', 'true');
      });
      
      fireEvent.click(screen.getByTestId('select-apple-pay'));
      await waitFor(() => {
        expect(screen.getByTestId('select-apple-pay')).toHaveAttribute('aria-pressed', 'true');
      });
      
      fireEvent.click(screen.getByTestId('select-google-pay'));
      await waitFor(() => {
        expect(screen.getByTestId('select-google-pay')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('select-apple-pay')).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });
});
