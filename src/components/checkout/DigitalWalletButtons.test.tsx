import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import DigitalWalletButtons from './DigitalWalletButtons';
import { useCart } from '@/context/CartContext';
import { usePaymentToast } from '@/hooks/useToast';
import { monitoring } from '@/utils/monitoring';

// Mock dependencies
jest.mock('@stripe/react-stripe-js');
jest.mock('@/context/CartContext');
jest.mock('@/hooks/useToast', () => ({
  useToast: jest.fn(),
  usePaymentToast: jest.fn(),
  useLegacyToast: jest.fn(),
}));
jest.mock('@/lib/stripe-client', () => ({
  logClientError: jest.fn(),
  generateIdempotencyKey: () => 'test-idempotency-key',
}));
jest.mock('@/constants/payments', () => ({
  formatCurrency: (amount: number) => `${amount.toFixed(2)} RON`,
}));
jest.mock('@/utils/monitoring', () => ({
  monitoring: {
    recordPaymentAttempt: jest.fn(),
    recordPaymentSuccess: jest.fn(),
    recordPaymentError: jest.fn(),
    startTimer: jest.fn(() => jest.fn()), // Returns a stop function
  },
}));

const mockUseStripe = useStripe as jest.MockedFunction<typeof useStripe>;
const mockUseElements = useElements as jest.MockedFunction<typeof useElements>;
const mockUseCart = useCart as jest.MockedFunction<typeof useCart>;
const mockUsePaymentToast = usePaymentToast as jest.MockedFunction<typeof usePaymentToast>;

// Mock Stripe instances
const mockStripe = {
  paymentRequest: jest.fn(),
  confirmCardPayment: jest.fn(),
};

const mockElements = {};

const mockPaymentRequest = {
  canMakePayment: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  show: jest.fn(),
};

const mockCart = {
  cartItems: [
    { 
      id: '1', 
      name: 'Test Product 1', 
      price: { original: 25.99, currency: 'RON' }, 
      quantity: 2,
      image: 'test-image-1.jpg'
    },
    { 
      id: '2', 
      name: 'Test Product 2', 
      price: { original: 15.50, currency: 'RON' }, 
      quantity: 1,
      image: 'test-image-2.jpg'
    },
  ],
  clearCart: jest.fn(),
};

const mockPaymentToast = {
  showPaymentProcessing: jest.fn(() => 'toast-id-123'),
  showPaymentError: jest.fn(() => 'toast-id-error'),
  showPaymentSuccess: jest.fn(() => 'toast-id-success'),
  showPaymentRetry: jest.fn(() => 'toast-id-retry'),
  showAuthenticationRequired: jest.fn(() => 'toast-id-auth'),
  showPaymentTimeout: jest.fn(() => 'toast-id-timeout'),
  updatePaymentProgress: jest.fn(),
  hideToast: jest.fn(),
};

describe('DigitalWalletButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseStripe.mockReturnValue(mockStripe as any);
    mockUseElements.mockReturnValue(mockElements as any);
    mockUseCart.mockReturnValue(mockCart as any);
    mockUsePaymentToast.mockReturnValue(mockPaymentToast as any);
    
    mockStripe.paymentRequest.mockReturnValue(mockPaymentRequest);
    
    // Ensure monitoring mock is properly setup after clearAllMocks
    (monitoring.startTimer as jest.Mock).mockReturnValue(jest.fn());
    
    // Mock successful payment request availability
    mockPaymentRequest.canMakePayment.mockResolvedValue({
      applePay: true,
      googlePay: true,
    });
    
    // Mock global fetch for payment intent creation
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          clientSecret: 'pi_test_client_secret',
          orderId: 'order_test_123',
        }),
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Initialization', () => {
    it('shows loading state while initializing', () => {
      mockPaymentRequest.canMakePayment.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      expect(screen.getByText(/checking apple pay availability/i)).toBeInTheDocument();
      expect(screen.getByText(/checking apple pay availability/i)).toBeInTheDocument();
    });

    it('initializes payment request with correct parameters', async () => {
      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(mockStripe.paymentRequest).toHaveBeenCalledWith({
          country: 'RO',
          currency: 'ron',
          total: {
            label: 'Store Purchase',
            amount: 6748, // 67.48 * 100
          },
          displayItems: [
            {
              label: 'Test Product 1 × 2',
              amount: 5198, // 25.99 * 2 * 100
            },
            {
              label: 'Test Product 2 × 1',
              amount: 1550, // 15.50 * 100
            },
          ],
          requestPayerName: true,
          requestPayerEmail: true,
          requestPayerPhone: false,
          requestShipping: false,
        });
      });
    });
  });

  describe('Apple Pay', () => {
    it('renders Apple Pay button when available', async () => {
      mockPaymentRequest.canMakePayment.mockResolvedValue({
        applePay: true,
        googlePay: false,
      });

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Apple Pay')).toBeInTheDocument();
        expect(screen.getByText('Quick and secure payment')).toBeInTheDocument();
      });
    });

    it('shows unavailable message when Apple Pay is not supported', async () => {
      mockPaymentRequest.canMakePayment.mockResolvedValue(null);

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Apple Pay Not Available')).toBeInTheDocument();
        expect(screen.getByText(/Use Safari browser on iPhone, iPad, or Mac/i)).toBeInTheDocument();
      });
    });

    it('shows specific error message when Apple Pay is not available for device', async () => {
      mockPaymentRequest.canMakePayment.mockResolvedValue({
        applePay: false,
        googlePay: true,
      });

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Apple Pay is not available on this device or browser.')).toBeInTheDocument();
      });
    });
  });

  describe('Google Pay', () => {
    it('renders Google Pay button when available', async () => {
      mockPaymentRequest.canMakePayment.mockResolvedValue({
        applePay: false,
        googlePay: true,
      });

      render(
        <DigitalWalletButtons
          selectedMethod="google_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Google Pay')).toBeInTheDocument();
        expect(screen.getByText('Quick and secure payment')).toBeInTheDocument();
      });
    });

    it('shows unavailable message when Google Pay is not supported', async () => {
      mockPaymentRequest.canMakePayment.mockResolvedValue(null);

      render(
        <DigitalWalletButtons
          selectedMethod="google_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Google Pay Not Available')).toBeInTheDocument();
        expect(screen.getByText(/Use Chrome, Edge, or Android browser/i)).toBeInTheDocument();
      });
    });
  });

  describe('Payment Processing', () => {
    beforeEach(() => {
      mockPaymentRequest.canMakePayment.mockResolvedValue({
        applePay: true,
        googlePay: true,
      });
    });

    it('handles successful payment flow', async () => {
      const onPaymentSuccess = jest.fn();
      
      mockStripe.confirmCardPayment.mockResolvedValue({
        error: null,
        paymentIntent: {
          id: 'pi_test_123',
          status: 'succeeded',
        },
      });

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
          onPaymentSuccess={onPaymentSuccess}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      // Simulate payment method selection
      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        paymentMethod: { id: 'pm_test_123' },
        complete: jest.fn(),
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'test-idempotency-key',
          },
          body: JSON.stringify({
            amount: 6748,
            currency: 'ron',
            payment_method_id: 'pm_test_123',
            automatic_payment_methods: {
              enabled: false,
            },
            cart_items: mockCart.cartItems,
            payment_method_types: ['card'],
            capture_method: 'automatic',
          }),
        });
      });

      expect(mockStripe.confirmCardPayment).toHaveBeenCalledWith(
        'pi_test_client_secret',
        { payment_method: 'pm_test_123' }
      );
      
      expect(mockEvent.complete).toHaveBeenCalledWith('success');
      expect(onPaymentSuccess).toHaveBeenCalledWith({
        id: 'pi_test_123',
        status: 'succeeded',
      });
      expect(mockCart.clearCart).toHaveBeenCalled();
    });

    it('handles payment failure', async () => {
      const onPaymentError = jest.fn();
      
      mockStripe.confirmCardPayment.mockResolvedValue({
        error: {
          message: 'Your card was declined.',
          type: 'card_error',
        },
        paymentIntent: null,
      });

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
          onPaymentError={onPaymentError}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      // Simulate payment method selection with failure
      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        paymentMethod: { id: 'pm_test_123' },
        complete: jest.fn(),
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      await waitFor(() => {
        expect(mockEvent.complete).toHaveBeenCalledWith('fail');
        expect(onPaymentError).toHaveBeenCalledWith('Your card was declined.');
        expect(mockPaymentToast.showPaymentError).toHaveBeenCalledWith({
          message: 'Your card was declined.',
          category: 'card',
          isRetryable: false,
          severity: 'high',
        });
      });
    });

    it('handles payment intent creation failure', async () => {
      const onPaymentError = jest.fn();
      
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({
            error: 'Payment intent creation failed',
          }),
        })
      ) as jest.Mock;

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
          onPaymentError={onPaymentError}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      // Simulate payment method selection
      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        paymentMethod: { id: 'pm_test_123' },
        complete: jest.fn(),
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      await waitFor(() => {
        expect(mockEvent.complete).toHaveBeenCalledWith('fail');
        expect(onPaymentError).toHaveBeenCalledWith('Payment intent creation failed');
      });
    });

    it('shows processing overlay during payment', async () => {
      // Mock a delayed payment confirmation
      mockStripe.confirmCardPayment.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      // Simulate payment method selection
      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        paymentMethod: { id: 'pm_test_123' },
        complete: jest.fn(),
      };

      // Start payment processing
      paymentMethodHandler(mockEvent);

      await waitFor(() => {
        expect(screen.getByText('Processing payment...')).toBeInTheDocument();
        expect(screen.getByText("Please don't close this window")).toBeInTheDocument();
      });
    });

    it('calls onPaymentStart when payment begins', async () => {
      const onPaymentStart = jest.fn();
      
      mockStripe.confirmCardPayment.mockResolvedValue({
        error: null,
        paymentIntent: {
          id: 'pi_test_123',
          status: 'succeeded',
        },
      });

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
          onPaymentStart={onPaymentStart}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      // Simulate payment method selection
      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        paymentMethod: { id: 'pm_test_123' },
        complete: jest.fn(),
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      expect(onPaymentStart).toHaveBeenCalled();
    });
  });

  describe('UI Elements', () => {
    beforeEach(() => {
      mockPaymentRequest.canMakePayment.mockResolvedValue({
        applePay: true,
        googlePay: true,
      });
    });

    it('displays purchase summary correctly', async () => {
      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Purchase Summary')).toBeInTheDocument();
        expect(screen.getByText('Test Product 1 × 2')).toBeInTheDocument();
        expect(screen.getByText('51.98 RON')).toBeInTheDocument();
        expect(screen.getByText('Test Product 2 × 1')).toBeInTheDocument();
        expect(screen.getByText('15.50 RON')).toBeInTheDocument();
        expect(screen.getAllByText('67.48 RON')).toHaveLength(2); // Should appear in both summary and total
      });
    });

    it('shows truncated item list when more than 3 items', async () => {
      const cartWithManyItems = {
        ...mockCart,
        cartItems: [
          { id: '1', name: 'Item 1', price: 10, quantity: 1 },
          { id: '2', name: 'Item 2', price: 10, quantity: 1 },
          { id: '3', name: 'Item 3', price: 10, quantity: 1 },
          { id: '4', name: 'Item 4', price: 10, quantity: 1 },
          { id: '5', name: 'Item 5', price: 10, quantity: 1 },
        ],
      };
      
      mockUseCart.mockReturnValue(cartWithManyItems as any);

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={50}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Item 1 × 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2 × 1')).toBeInTheDocument();
        expect(screen.getByText('Item 3 × 1')).toBeInTheDocument();
        expect(screen.getByText('+ 2 more items')).toBeInTheDocument();
      });
    });

    it('displays security and terms information', async () => {
      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Your payment information is secured by Stripe')).toBeInTheDocument();
        expect(screen.getByText(/by completing this payment, you agree to our/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /terms of service/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
      });
    });

    it('shows disabled state when disabled prop is true', async () => {
      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
          disabled={true}
        />
      );

      await waitFor(() => {
        const disabledOverlay = document.querySelector('.cursor-not-allowed');
        expect(disabledOverlay).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('removes event listeners on unmount', async () => {
      mockPaymentRequest.canMakePayment.mockResolvedValue({
        applePay: true,
        googlePay: true,
      });

      const { unmount } = render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalled();
      });

      unmount();

      expect(mockPaymentRequest.off).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
    });
  });

  describe('Monitoring Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Ensure monitoring mock is properly setup
      (monitoring.startTimer as jest.Mock).mockReturnValue(jest.fn());
      
      // Mock successful payment flow
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          clientSecret: 'pi_test_client_secret',
          orderId: 'order_test_123',
        }),
      });

      mockStripe.confirmCardPayment.mockResolvedValue({
        paymentIntent: {
          id: 'pi_test_123',
          status: 'succeeded',
        },
        error: null,
      });
    });

    it('records payment attempt when digital wallet payment starts', async () => {
      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
          onPaymentStart={() => {}}
          onPaymentSuccess={() => {}}
          onPaymentError={() => {}}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        complete: jest.fn(),
        paymentMethod: { id: 'pm_test_123' },
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      expect(monitoring.recordPaymentAttempt).toHaveBeenCalled();
    });

    it('records successful digital wallet payment', async () => {
      render(
        <DigitalWalletButtons
          selectedMethod="google_pay"
          amount={67.48}
          onPaymentStart={() => {}}
          onPaymentSuccess={() => {}}
          onPaymentError={() => {}}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        complete: jest.fn(),
        paymentMethod: { id: 'pm_test_123' },
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      expect(monitoring.recordPaymentSuccess).toHaveBeenCalled();
      expect(mockEvent.complete).toHaveBeenCalledWith('success');
    });

    it('records payment error for failed status', async () => {
      // Mock payment with requires_payment_method status (failure)
      mockStripe.confirmCardPayment.mockResolvedValue({
        paymentIntent: {
          id: 'pi_test_123',
          status: 'requires_payment_method',
        },
        error: null,
      });

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
          onPaymentStart={() => {}}
          onPaymentSuccess={() => {}}
          onPaymentError={() => {}}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        complete: jest.fn(),
        paymentMethod: { id: 'pm_test_123' },
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      expect(monitoring.recordPaymentError).toHaveBeenCalledWith(
        'digital_wallet_status_failure',
        expect.objectContaining({
          paymentStatus: 'requires_payment_method',
          selectedMethod: 'apple_pay',
          amount: 67.48,
        })
      );
      expect(mockEvent.complete).toHaveBeenCalledWith('fail');
    });

    it('records payment error for exceptions', async () => {
      // Mock payment intent creation failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      render(
        <DigitalWalletButtons
          selectedMethod="google_pay"
          amount={67.48}
          onPaymentStart={() => {}}
          onPaymentSuccess={() => {}}
          onPaymentError={() => {}}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        complete: jest.fn(),
        paymentMethod: { id: 'pm_test_123' },
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      expect(monitoring.recordPaymentError).toHaveBeenCalledWith(
        'digital_wallet_exception',
        expect.objectContaining({
          errorMessage: 'Network error',
          selectedMethod: 'google_pay',
          amount: 67.48,
          context: 'digital_wallet_payment_processing',
        })
      );
      expect(mockEvent.complete).toHaveBeenCalledWith('fail');
    });

    it('starts and stops payment processing timer', async () => {
      const mockStopTimer = jest.fn();
      (monitoring.startTimer as jest.Mock).mockReturnValue(mockStopTimer);

      render(
        <DigitalWalletButtons
          selectedMethod="apple_pay"
          amount={67.48}
          onPaymentStart={() => {}}
          onPaymentSuccess={() => {}}
          onPaymentError={() => {}}
        />
      );

      await waitFor(() => {
        expect(mockPaymentRequest.on).toHaveBeenCalledWith('paymentmethod', expect.any(Function));
      });

      const paymentMethodHandler = mockPaymentRequest.on.mock.calls[0][1];
      const mockEvent = {
        complete: jest.fn(),
        paymentMethod: { id: 'pm_test_123' },
      };

      await act(async () => {
        await paymentMethodHandler(mockEvent);
      });

      expect(monitoring.startTimer).toHaveBeenCalledWith('client.payment_processing');
      expect(mockStopTimer).toHaveBeenCalled();
    });
  });
});
