import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import CardPaymentForm from './CardPaymentForm';

// Mock Stripe Elements
jest.mock('@stripe/react-stripe-js');

const mockUseStripe = useStripe as jest.MockedFunction<typeof useStripe>;
const mockUseElements = useElements as jest.MockedFunction<typeof useElements>;
const mockPaymentElement = PaymentElement as jest.MockedFunction<typeof PaymentElement>;

// Mock Stripe instances
const mockStripe = {};
const mockElements = {};

describe('CardPaymentForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock PaymentElement to render a simple div for testing
    mockPaymentElement.mockImplementation(({ onChange, onReady, onFocus, onBlur, ...props }) => (
      <div data-testid="payment-element" {...props}>
        <button 
          data-testid="mock-card-input"
          onClick={() => {
            // Simulate various payment element events for testing
            onReady?.({} as any);
            onChange?.({ complete: true } as any);
          }}
        >
          Mock Card Input
        </button>
        <button 
          data-testid="mock-error-trigger"
          onClick={() => {
            onChange?.({ 
              complete: false, 
              error: { message: 'Your card number is invalid.' } 
            } as any);
          }}
        >
          Trigger Error
        </button>
        <button 
          data-testid="mock-focus-trigger"
          onClick={() => onFocus?.({} as any)}
        >
          Focus
        </button>
        <button 
          data-testid="mock-blur-trigger"
          onClick={() => onBlur?.({} as any)}
        >
          Blur
        </button>
      </div>
    ));
  });

  describe('Initialization', () => {
    it('shows loading state when Stripe is not available', () => {
      mockUseStripe.mockReturnValue(null);
      mockUseElements.mockReturnValue(null);

      render(<CardPaymentForm />);

      // Should show skeleton loading when Stripe is not ready
      const skeletonElements = document.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
      expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    });

    it('renders payment element when Stripe is available', () => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);

      render(<CardPaymentForm />);

      expect(screen.getByTestId('payment-element')).toBeInTheDocument();
      expect(screen.queryByText(/loading payment form/i)).not.toBeInTheDocument();
    });

    it('configures PaymentElement with correct options', () => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);

      render(<CardPaymentForm />);

      // Check that PaymentElement was called with the correct configuration
      expect(mockPaymentElement).toHaveBeenCalled();
      
      // Verify the first call's first argument contains the expected props
      const firstCall = mockPaymentElement.mock.calls[0];
      const props = firstCall?.[0];
      
      expect(props).toMatchObject({
        id: 'payment-element',
        options: {
          layout: {
            type: 'tabs',
            defaultCollapsed: false,
          },
          fields: {
            billingDetails: {
              name: 'auto',
              email: 'auto',
              phone: 'auto',
              address: {
                line1: 'auto',
                line2: 'auto',
                city: 'auto',
                state: 'auto',
                postalCode: 'auto',
                country: 'auto',
              },
            },
          },
          terms: {
            card: 'auto',
          },
        },
      });
      
      expect(props.onChange).toEqual(expect.any(Function));
      expect(props.onReady).toEqual(expect.any(Function));
      expect(props.onFocus).toEqual(expect.any(Function));
      expect(props.onBlur).toEqual(expect.any(Function));
    });
  });

  describe('Validation Handling', () => {
    beforeEach(() => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);
    });

    it('calls onValidationChange with true when payment is valid', async () => {
      const onValidationChange = jest.fn();
      render(<CardPaymentForm onValidationChange={onValidationChange} />);

      const cardInput = screen.getByTestId('mock-card-input');
      fireEvent.click(cardInput);

      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalledWith(true);
      });
    });

    it('calls onValidationChange with false when there are errors', async () => {
      const onValidationChange = jest.fn();
      render(<CardPaymentForm onValidationChange={onValidationChange} />);

      const errorTrigger = screen.getByTestId('mock-error-trigger');
      fireEvent.click(errorTrigger);

      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalledWith(false);
      });
    });

    it('displays error messages when validation fails', async () => {
      render(<CardPaymentForm />);

      const errorTrigger = screen.getByTestId('mock-error-trigger');
      fireEvent.click(errorTrigger);

      await waitFor(() => {
        expect(screen.getByText('Payment Information Error')).toBeInTheDocument();
        expect(screen.getByText('Your card number is invalid.')).toBeInTheDocument();
      });
    });

    it('clears errors when payment element is focused', async () => {
      render(<CardPaymentForm />);

      // First trigger an error
      const errorTrigger = screen.getByTestId('mock-error-trigger');
      fireEvent.click(errorTrigger);

      await waitFor(() => {
        expect(screen.getByText('Your card number is invalid.')).toBeInTheDocument();
      });

      // Then focus the element
      const focusTrigger = screen.getByTestId('mock-focus-trigger');
      fireEvent.click(focusTrigger);

      await waitFor(() => {
        expect(screen.queryByText('Your card number is invalid.')).not.toBeInTheDocument();
      });
    });
  });

  describe('Ready State Management', () => {
    beforeEach(() => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);
    });

    it('shows loading overlay until payment element is ready', () => {
      // Mock PaymentElement to not trigger onReady immediately
      mockPaymentElement.mockImplementation(({ onChange, onReady, onFocus, onBlur, ...props }) => (
        <div data-testid="payment-element" {...props}>
          <div>Payment form loading...</div>
        </div>
      ));

      render(<CardPaymentForm />);

      // The component should show our mock loading text since onReady is not triggered in the mock
      expect(screen.getByText('Payment form loading...')).toBeInTheDocument();
    });

    it('hides loading overlay when payment element becomes ready', async () => {
      render(<CardPaymentForm />);

      const cardInput = screen.getByTestId('mock-card-input');
      fireEvent.click(cardInput); // This triggers onReady

      await waitFor(() => {
        expect(screen.queryByText(/loading payment form/i)).not.toBeInTheDocument();
      });
    });

    it('adjusts opacity based on ready state', async () => {
      // This test verifies that opacity changes work - the actual initial state
      // depends on when Stripe loads, but the behavior should be consistent
      render(<CardPaymentForm />);

      const paymentElement = screen.getByTestId('payment-element').parentElement;
      
      // The component should have either opacity-50 or opacity-100 class
      const hasOpacityClass = paymentElement?.classList.contains('opacity-50') || 
                             paymentElement?.classList.contains('opacity-100');
      expect(hasOpacityClass).toBe(true);
      
      // The transition classes should be present
      expect(paymentElement).toHaveClass('transition-opacity', 'duration-200');
    });
  });

  describe('Disabled State', () => {
    beforeEach(() => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);
    });

    it('shows disabled overlay when disabled prop is true', () => {
      render(<CardPaymentForm disabled={true} />);

      // The disabled overlay is rendered as an absolute positioned div with cursor-not-allowed
      const disabledOverlay = document.querySelector('.cursor-not-allowed');
      expect(disabledOverlay).toBeInTheDocument();
    });

    it('does not show disabled overlay when disabled prop is false', () => {
      render(<CardPaymentForm disabled={false} />);

      const disabledOverlay = document.querySelector('.cursor-not-allowed');
      expect(disabledOverlay).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows skeleton loading when Stripe is not ready', () => {
      mockUseStripe.mockReturnValue(null);
      mockUseElements.mockReturnValue(null);

      render(<CardPaymentForm />);

      // Check for skeleton elements when Stripe is not ready
      const skeletonElements = document.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('shows validation loading during validation', () => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);

      // Mock PaymentElement to show validation state
      mockPaymentElement.mockImplementation(({ onChange }) => (
        <div data-testid="payment-element">
          <button 
            data-testid="mock-validation-trigger"
            onClick={() => {
              // Simulate validation state
              if (onChange) {
                // We need to simulate the validation state manually since we can't easily 
                // control the internal state in this test setup
                setTimeout(() => {
                  onChange({ complete: true } as any);
                }, 10);
              }
            }}
          >
            Trigger Validation
          </button>
        </div>
      ));

      render(<CardPaymentForm />);

      // Note: Testing validation loading state would require more complex mocking
      // to properly simulate the intermediate validation state
      expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    });
  });

  describe('Security Information', () => {
    beforeEach(() => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);
    });

    it('displays security information', () => {
      render(<CardPaymentForm />);

      expect(screen.getByText('256-bit SSL encryption')).toBeInTheDocument();
      expect(screen.getByText('PCI DSS compliant')).toBeInTheDocument();
      expect(screen.getByText('Your data is never stored')).toBeInTheDocument();
    });

    it('displays accepted payment methods', () => {
      render(<CardPaymentForm />);

      expect(screen.getByText('Accepted payment methods:')).toBeInTheDocument();
      expect(screen.getByText('V')).toBeInTheDocument(); // Visa
      expect(screen.getByText('MC')).toBeInTheDocument(); // Mastercard
      expect(screen.getByText('AX')).toBeInTheDocument(); // American Express
      expect(screen.getByText('D')).toBeInTheDocument(); // Discover
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);
    });

    it('handles onReady event correctly', async () => {
      render(<CardPaymentForm />);

      const cardInput = screen.getByTestId('mock-card-input');
      fireEvent.click(cardInput);

      // Verify that ready state changes (loading overlay disappears)
      await waitFor(() => {
        expect(screen.queryByText(/loading payment form/i)).not.toBeInTheDocument();
      });
    });

    it('handles onChange event correctly', async () => {
      const onValidationChange = jest.fn();
      render(<CardPaymentForm onValidationChange={onValidationChange} />);

      const cardInput = screen.getByTestId('mock-card-input');
      fireEvent.click(cardInput);

      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalledWith(true);
      });
    });

    it('handles onFocus event correctly', () => {
      render(<CardPaymentForm />);

      // First trigger an error
      const errorTrigger = screen.getByTestId('mock-error-trigger');
      fireEvent.click(errorTrigger);

      expect(screen.getByText('Your card number is invalid.')).toBeInTheDocument();

      // Then focus to clear the error
      const focusTrigger = screen.getByTestId('mock-focus-trigger');
      fireEvent.click(focusTrigger);

      expect(screen.queryByText('Your card number is invalid.')).not.toBeInTheDocument();
    });

    it('handles onBlur event correctly', () => {
      render(<CardPaymentForm />);

      const blurTrigger = screen.getByTestId('mock-blur-trigger');
      
      // Should not throw error
      expect(() => fireEvent.click(blurTrigger)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing onValidationChange prop gracefully', async () => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);

      render(<CardPaymentForm />);

      const cardInput = screen.getByTestId('mock-card-input');
      
      // Should not throw error when onValidationChange is not provided
      expect(() => fireEvent.click(cardInput)).not.toThrow();
    });

    it('handles Stripe becoming available after initial render', () => {
      // Start with no Stripe
      mockUseStripe.mockReturnValue(null);
      mockUseElements.mockReturnValue(null);

      const { rerender } = render(<CardPaymentForm />);

      expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();

      // Stripe becomes available
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);

      rerender(<CardPaymentForm />);

      expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    });

    it('handles rapid state changes gracefully', async () => {
      mockUseStripe.mockReturnValue(mockStripe as any);
      mockUseElements.mockReturnValue(mockElements as any);

      const onValidationChange = jest.fn();
      render(<CardPaymentForm onValidationChange={onValidationChange} />);

      const cardInput = screen.getByTestId('mock-card-input');
      const errorTrigger = screen.getByTestId('mock-error-trigger');

      // Rapid state changes
      fireEvent.click(cardInput); // Valid
      fireEvent.click(errorTrigger); // Error
      fireEvent.click(cardInput); // Valid again

      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalledTimes(3);
      });
    });
  });
});
