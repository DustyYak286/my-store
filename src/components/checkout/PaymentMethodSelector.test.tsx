import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PaymentMethodSelector from './PaymentMethodSelector';
import { PaymentMethod } from './PaymentSection';

describe('PaymentMethodSelector', () => {
  const defaultProps = {
    availableMethods: {
      card: true,
      applePay: true,
      googlePay: true,
    },
    selectedMethod: 'card' as PaymentMethod,
    onMethodChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all available payment methods', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('Select Payment Method')).toBeInTheDocument();
      expect(screen.getByText('Card')).toBeInTheDocument();
      expect(screen.getByText('Credit or Debit Card')).toBeInTheDocument();
      expect(screen.getByText('Apple Pay')).toBeInTheDocument();
      expect(screen.getByText('Pay with Touch ID or Face ID')).toBeInTheDocument();
      expect(screen.getByText('Google Pay')).toBeInTheDocument();
      expect(screen.getByText('Quick & secure payments')).toBeInTheDocument();
    });

    it('only renders available payment methods', () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          availableMethods={{
            card: true,
            applePay: false,
            googlePay: true,
          }}
        />
      );

      expect(screen.getByText('Card')).toBeInTheDocument();
      expect(screen.queryByText('Apple Pay')).not.toBeInTheDocument();
      expect(screen.getByText('Google Pay')).toBeInTheDocument();
    });

    it('shows no payment methods message when none are available', () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          availableMethods={{
            card: false,
            applePay: false,
            googlePay: false,
          }}
        />
      );

      expect(screen.getByText('No payment methods available')).toBeInTheDocument();
      expect(screen.queryByText('Card')).not.toBeInTheDocument();
      expect(screen.queryByText('Apple Pay')).not.toBeInTheDocument();
      expect(screen.queryByText('Google Pay')).not.toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('shows selected method with proper styling', () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          selectedMethod="apple_pay"
        />
      );

      const applePayButton = screen.getByRole('button', { name: /apple pay/i });
      const cardButton = screen.getByRole('button', { name: /card/i });

      expect(applePayButton).toHaveClass('border-blue-500', 'bg-blue-50', 'ring-2', 'ring-blue-200');
      expect(applePayButton).toHaveAttribute('aria-pressed', 'true');
      
      expect(cardButton).toHaveClass('border-gray-200', 'bg-white');
      expect(cardButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows selection indicator for selected method', () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          selectedMethod="apple_pay"
        />
      );

      const applePayButton = screen.getByRole('button', { name: /apple pay/i });
      
      // Check for the radio button indicator
      const radioIndicator = applePayButton.querySelector('.rounded-full.border-blue-500.bg-blue-500');
      expect(radioIndicator).toBeInTheDocument();
      
      // Check for the checkmark in top-right corner
      const checkmark = applePayButton.querySelector('.absolute.-top-1.-right-1');
      expect(checkmark).toBeInTheDocument();
    });

    it('does not show selection indicators for unselected methods', () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          selectedMethod="apple_pay"
        />
      );

      const cardButton = screen.getByRole('button', { name: /card/i });
      
      // Check that radio button is not selected
      const radioIndicator = cardButton.querySelector('.rounded-full.border-gray-300.bg-white');
      expect(radioIndicator).toBeInTheDocument();
      
      // Check that checkmark is not present
      const checkmark = cardButton.querySelector('.absolute.-top-1.-right-1');
      expect(checkmark).not.toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onMethodChange when a payment method is clicked', () => {
      const onMethodChange = jest.fn();
      render(
        <PaymentMethodSelector
          {...defaultProps}
          onMethodChange={onMethodChange}
        />
      );

      const applePayButton = screen.getByRole('button', { name: /apple pay/i });
      fireEvent.click(applePayButton);

      expect(onMethodChange).toHaveBeenCalledWith('apple_pay');
    });

    it('calls onMethodChange with correct method for each button', () => {
      const onMethodChange = jest.fn();
      render(
        <PaymentMethodSelector
          {...defaultProps}
          onMethodChange={onMethodChange}
        />
      );

      const cardButton = screen.getByRole('button', { name: /card/i });
      const applePayButton = screen.getByRole('button', { name: /apple pay/i });
      const googlePayButton = screen.getByRole('button', { name: /google pay/i });

      fireEvent.click(cardButton);
      expect(onMethodChange).toHaveBeenCalledWith('card');

      fireEvent.click(applePayButton);
      expect(onMethodChange).toHaveBeenCalledWith('apple_pay');

      fireEvent.click(googlePayButton);
      expect(onMethodChange).toHaveBeenCalledWith('google_pay');

      expect(onMethodChange).toHaveBeenCalledTimes(3);
    });

    it('does not call onMethodChange when disabled', () => {
      const onMethodChange = jest.fn();
      render(
        <PaymentMethodSelector
          {...defaultProps}
          onMethodChange={onMethodChange}
          disabled={true}
        />
      );

      const cardButton = screen.getByRole('button', { name: /card/i });
      fireEvent.click(cardButton);

      expect(onMethodChange).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('applies disabled styling to all buttons when disabled', () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          disabled={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
        expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
      });
    });

    it('removes hover effects when disabled', () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          disabled={true}
        />
      );

      const cardButton = screen.getByRole('button', { name: /card/i });
      expect(cardButton).not.toHaveClass('cursor-pointer');
      expect(cardButton).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-pressed');
        expect(button).toHaveAttribute('aria-describedby');
      });
    });

    it('has proper focus management', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const cardButton = screen.getByRole('button', { name: /card/i });
      cardButton.focus();

      expect(cardButton).toHaveFocus();
      expect(cardButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
    });

    it('has descriptive text for each payment method', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('Credit or Debit Card')).toBeInTheDocument();
      expect(screen.getByText('Pay with Touch ID or Face ID')).toBeInTheDocument();
      expect(screen.getByText('Quick & secure payments')).toBeInTheDocument();
    });

    it('associates descriptions with buttons using aria-describedby', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const cardButton = screen.getByRole('button', { name: /card/i });
      const applePayButton = screen.getByRole('button', { name: /apple pay/i });
      const googlePayButton = screen.getByRole('button', { name: /google pay/i });

      expect(cardButton).toHaveAttribute('aria-describedby', 'card-description');
      expect(applePayButton).toHaveAttribute('aria-describedby', 'apple_pay-description');
      expect(googlePayButton).toHaveAttribute('aria-describedby', 'google_pay-description');

      expect(screen.getByText('Credit or Debit Card')).toHaveAttribute('id', 'card-description');
      expect(screen.getByText('Pay with Touch ID or Face ID')).toHaveAttribute('id', 'apple_pay-description');
      expect(screen.getByText('Quick & secure payments')).toHaveAttribute('id', 'google_pay-description');
    });
  });

  describe('Visual Elements', () => {
    it('renders payment method icons', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      // Card icons should be visible
      expect(screen.getByText('V')).toBeInTheDocument(); // Visa
      expect(screen.getByText('MC')).toBeInTheDocument(); // Mastercard

      // SVG icons should be present (we can't easily test for specific SVG content in JSDOM)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const svgElements = button.querySelectorAll('svg');
        expect(svgElements.length).toBeGreaterThan(0);
      });
    });

    it('has proper responsive grid layout', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const grid = screen.getAllByRole('button')[0].parentElement;
      expect(grid).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-3');
    });
  });

  describe('Edge Cases', () => {
    it('handles single payment method', () => {
      render(
        <PaymentMethodSelector
          {...defaultProps}
          availableMethods={{
            card: true,
            applePay: false,
            googlePay: false,
          }}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(screen.getByText('Card')).toBeInTheDocument();
    });

    it('handles rapid method changes', () => {
      const onMethodChange = jest.fn();
      render(
        <PaymentMethodSelector
          {...defaultProps}
          onMethodChange={onMethodChange}
        />
      );

      const applePayButton = screen.getByRole('button', { name: /apple pay/i });
      const googlePayButton = screen.getByRole('button', { name: /google pay/i });

      // Rapid clicks
      fireEvent.click(applePayButton);
      fireEvent.click(googlePayButton);
      fireEvent.click(applePayButton);

      expect(onMethodChange).toHaveBeenCalledTimes(3);
      expect(onMethodChange).toHaveBeenNthCalledWith(1, 'apple_pay');
      expect(onMethodChange).toHaveBeenNthCalledWith(2, 'google_pay');
      expect(onMethodChange).toHaveBeenNthCalledWith(3, 'apple_pay');
    });

    it('maintains selection state when availableMethods changes', () => {
      const { rerender } = render(
        <PaymentMethodSelector
          {...defaultProps}
          selectedMethod="apple_pay"
        />
      );

      expect(screen.getByRole('button', { name: /apple pay/i })).toHaveAttribute('aria-pressed', 'true');

      // Remove Apple Pay availability but keep it selected
      rerender(
        <PaymentMethodSelector
          {...defaultProps}
          selectedMethod="apple_pay"
          availableMethods={{
            card: true,
            applePay: false,
            googlePay: true,
          }}
        />
      );

      // Apple Pay should no longer be visible
      expect(screen.queryByText('Apple Pay')).not.toBeInTheDocument();
      expect(screen.getByText('Card')).toBeInTheDocument();
      expect(screen.getByText('Google Pay')).toBeInTheDocument();
    });
  });
});
