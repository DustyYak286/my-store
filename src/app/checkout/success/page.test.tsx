/**
 * Payment Success Page Tests
 * 
 * Tests for payment success page including order display,
 * conversion tracking, and user interactions.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import PaymentSuccessPage from './page';
import { getOrderById, getOrderByNumber } from '@/lib/orderStore';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';
import { CartProvider } from '@/context/CartContext';
import { CartModalProvider } from '@/context/CartModalContext';
import { ToastProvider } from '@/context/ToastContext';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

// Mock order store
jest.mock('@/lib/orderStore', () => ({
  getOrderById: jest.fn(),
  getOrderByNumber: jest.fn(),
}));

// Mock audit trail
jest.mock('@/utils/auditTrail', () => ({
  searchAuditTrail: jest.fn(() => []),
}));

// Mock formatPrice
jest.mock('@/utils/formatPrice', () => ({
  formatPrice: jest.fn((amount: number, currency: string) => `${amount} ${currency.toUpperCase()}`),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

const mockUseSearchParams = useSearchParams as jest.Mock;
const mockGetOrderById = getOrderById as jest.Mock;
const mockGetOrderByNumber = getOrderByNumber as jest.Mock;

// Helper function to render components with all required providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <CartProvider>
      <CartModalProvider>
        <ToastProvider>
          {component}
        </ToastProvider>
      </CartModalProvider>
    </CartProvider>
  );
};

describe('PaymentSuccessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  const mockOrder: Order = {
    id: 'order_123',
    orderNumber: 'ORD-2024-001',
    status: OrderStatus.PAID,
    paymentStatus: PaymentStatus.SUCCEEDED,
    customerInfo: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      isGuest: true,
    },
    shippingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Main St',
      city: 'Anytown',
      postalCode: '12345',
      country: 'US',
    },
    billingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Main St',
      city: 'Anytown',
      postalCode: '12345',
      country: 'US',
    },
    items: [
      {
        id: 1,
        name: 'Test Product',
        price: 25.00,
        quantity: 2,
        image: 'test-image.jpg',
      },
    ],
    totals: {
      subtotal: 50.00,
      discount: 0,
      shipping: 5.00,
      tax: 4.50,
      total: 59.50,
      currency: 'usd',
    },
    currency: 'usd',
    payment: {
      paymentIntentId: 'pi_test123',
      amount: 5950,
      currency: 'usd',
    },
    timestamps: {
      createdAt: '2024-01-01T12:00:00Z',
      updatedAt: '2024-01-01T12:05:00Z',
    },
    statusHistory: [],
    source: 'web',
    priority: 'standard',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window methods
    Object.defineProperty(window, 'print', {
      value: jest.fn(),
      writable: true,
    });
    
    // Mock analytics
    (global as any).gtag = jest.fn();
    (global as any).fbq = jest.fn();
    (global as any).dataLayer = [];
  });

  it('should show loading state before processing completes', () => {
    // Mock React's useState to test initial loading state
    const mockSetLoading = jest.fn();
    const originalUseState = React.useState;
    jest.spyOn(React, 'useState').mockImplementation((initial) => {
      if (initial === true) { // This is the loading state
        return [true, mockSetLoading];
      }
      return originalUseState(initial);
    });

    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    
    renderWithProviders(<PaymentSuccessPage />);
    
    expect(screen.getByText('Loading your order confirmation...')).toBeInTheDocument();
    
    // Cleanup
    jest.restoreAllMocks();
  });

  it('should display successful order with order_id parameter', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    mockGetOrderById.mockReturnValue(mockOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    expect(screen.getByText('ORD-2024-001')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('should display successful order with order_number parameter', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_number=ORD-2024-001'));
    mockGetOrderByNumber.mockReturnValue(mockOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    expect(mockGetOrderByNumber).toHaveBeenCalledWith('ORD-2024-001');
    expect(screen.getByText('ORD-2024-001')).toBeInTheDocument();
  });

  it('should show error when no order parameters provided', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams(''));

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Order')).toBeInTheDocument();
    });

    expect(screen.getByText(/Missing order information/)).toBeInTheDocument();
    expect(screen.getByText('Return to Store')).toBeInTheDocument();
  });

  it('should show error when order not found', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=nonexistent'));
    mockGetOrderById.mockReturnValue(null);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Order')).toBeInTheDocument();
    });

    expect(screen.getByText(/Order not found/)).toBeInTheDocument();
  });

  it('should show processing message for unpaid order', async () => {
    const unpaidOrder = { ...mockOrder, status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING };
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    mockGetOrderById.mockReturnValue(unpaidOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Order')).toBeInTheDocument();
    });

    expect(screen.getByText(/Payment confirmation is still processing/)).toBeInTheDocument();
  });

  it('should display order totals correctly', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    mockGetOrderById.mockReturnValue(mockOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    // Check if totals are displayed
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
    expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
  });

  it('should display order items correctly', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    mockGetOrderById.mockReturnValue(mockOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('Quantity: 2')).toBeInTheDocument();
  });

  it('should track conversion analytics', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123&payment_intent=pi_test123'));
    mockGetOrderById.mockReturnValue(mockOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    // Wait a bit for useEffect to run
    await waitFor(() => {
      expect((global as any).gtag).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({
        transaction_id: 'order_123',
        value: 59.50,
        currency: 'USD',
      }));
    });

    expect((global as any).fbq).toHaveBeenCalledWith('track', 'Purchase', expect.objectContaining({
      value: 59.50,
      currency: 'USD',
    }));

    expect((global as any).dataLayer).toContainEqual(expect.objectContaining({
      event: 'ecommerce_purchase',
      ecommerce: expect.objectContaining({
        transaction_id: 'order_123',
        value: 59.50,
        currency: 'USD',
      }),
    }));
  });

  it('should handle print receipt click', async () => {
    const mockPrint = jest.fn();
    Object.defineProperty(window, 'print', { value: mockPrint });

    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    mockGetOrderById.mockReturnValue(mockOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    const printButton = screen.getByText('Print Receipt');
    printButton.click();

    expect(mockPrint).toHaveBeenCalled();
  });

  it('should display what happens next section', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    mockGetOrderById.mockReturnValue(mockOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    expect(screen.getByText('What happens next?')).toBeInTheDocument();
    expect(screen.getByText(/You'll receive an order confirmation email/)).toBeInTheDocument();
    expect(screen.getByText(/We'll prepare your order for shipping/)).toBeInTheDocument();
    expect(screen.getByText(/You'll get tracking information/)).toBeInTheDocument();
  });

  it('should handle orders with discount', async () => {
    const discountedOrder = {
      ...mockOrder,
      totals: {
        ...mockOrder.totals,
        discount: 10.00,
        total: 49.50,
      },
    };

    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    mockGetOrderById.mockReturnValue(discountedOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    expect(screen.getByText(/Discount/)).toBeInTheDocument();
  });

  it('should handle image loading errors', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('order_id=order_123'));
    mockGetOrderById.mockReturnValue(mockOrder);

    renderWithProviders(<PaymentSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    const image = screen.getByAltText('Test Product') as HTMLImageElement;
    
    // Simulate image load error
    const errorEvent = new Event('error');
    Object.defineProperty(errorEvent, 'target', {
      value: image,
      enumerable: true,
    });
    
    image.dispatchEvent(errorEvent);
    
    expect(image.src).toContain('placeholder-product.jpg');
  });
});