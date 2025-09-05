import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import CheckoutForm from "./CheckoutForm";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/useToast";
import { useStripePayment } from "@/hooks/useStripePayment";

// Mock the dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/context/CartContext", () => ({
  useCart: jest.fn(),
}));

jest.mock("@/hooks/useToast", () => ({
  useToast: jest.fn(),
  usePaymentToast: jest.fn(),
  useLegacyToast: jest.fn(),
}));

jest.mock("@/hooks/useStripePayment", () => ({
  useStripePayment: jest.fn(),
}));

// Mock Stripe
jest.mock("@stripe/react-stripe-js", () => ({
  useStripe: jest.fn(() => null),
  useElements: jest.fn(() => null),
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="stripe-payment-element">Payment Element</div>,
}));

// Mock fetch for payment intent API calls
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

jest.mock("@/lib/stripe-client", () => ({
  getStripe: jest.fn(() => Promise.resolve(null)),
  detectAvailablePaymentMethods: jest.fn(() => ({
    card: true,
    applePay: false,
    googlePay: false,
  })),
}));

// Mock router
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
};

// Mock cart context with actual items (required for form rendering)
const mockClearCart = jest.fn();
const mockCartContext = {
  clearCart: mockClearCart,
  cartTotal: 25.99,
  items: [
    {
      id: 1,
      name: "Test Product",
      price: 25.99,
      quantity: 1,
      image: "/test-image.jpg"
    }
  ],
  cartItems: [ // This is what CheckoutForm actually uses
    {
      id: 1,
      name: "Test Product",
      price: 25.99,
      quantity: 1,
      image: "/test-image.jpg"
    }
  ],
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateQuantity: jest.fn(),
  itemCount: 1,
};

// Mock toast hook
const mockShowToast = jest.fn();
const mockHideToast = jest.fn();
const mockToastHook = {
  toast: { message: "", isVisible: false, type: "success" as const },
  showToast: mockShowToast,
  hideToast: mockHideToast,
};

const mockStripePaymentHook = {
  paymentState: {
    isProcessing: false,
    isSubmitting: false,
    currentAttempt: 0,
    hasStarted: false,
    timeoutWarningShown: false,
    startTime: null,
    lastError: null,
  },
  processPayment: jest.fn(),
  retryPayment: jest.fn(),
  cancelPayment: jest.fn(),
  resetPaymentState: jest.fn(),
  canRetry: false,
  timeElapsed: 0,
  isTimeout: false,
};

describe("CheckoutForm", () => {
  beforeEach(() => {
    // Clear all mocks first
    jest.clearAllMocks();
    
    // Setup mocks
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useCart as jest.Mock).mockReturnValue(mockCartContext);
    (useToast as jest.Mock).mockReturnValue(mockToastHook);
    (useStripePayment as jest.Mock).mockReturnValue(mockStripePaymentHook);
    
    // Mock payment intent API call
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        paymentIntent: {
          id: 'pi_test_123',
          clientSecret: 'pi_test_123_secret_test',
          status: 'requires_payment_method'
        },
        orderDraft: {
          id: 'order_draft_123',
          orderNumber: 'ORD-TEST-001'
        }
      })
    });
  });

  describe("Form Rendering", () => {
    it("renders all required form sections", async () => {
      render(<CheckoutForm />);

      // Wait for the payment initialization to complete and form to render
      await waitFor(() => {
        expect(screen.getByText("Contact Information")).toBeInTheDocument();
      }, { timeout: 5000 });
      
      expect(screen.getByText("Shipping Address")).toBeInTheDocument();
      expect(screen.getByText("Billing Address")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Payment Information" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /complete order/i })).toBeInTheDocument();
    });

    it("renders all required form fields", async () => {
      render(<CheckoutForm />);
      
      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Contact Information
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();

      // Shipping Address
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/country/i)).toBeInTheDocument();

      // Billing Address
      expect(screen.getByLabelText(/same as shipping address/i)).toBeInTheDocument();
    });

    it("renders submit button as disabled by default", async () => {
      render(<CheckoutForm />);
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /complete order/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const submitButton = screen.getByRole("button", { name: /complete order/i });
      expect(submitButton).toBeDisabled();
    });

    it("submit button is disabled when form is incomplete", async () => {
      render(<CheckoutForm />);
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /complete order/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      // Button should be disabled when form is empty
      const submitButton = screen.getByRole("button", { name: /complete order/i });
      expect(submitButton).toBeDisabled();
    });

    it("has proper form structure", async () => {
      render(<CheckoutForm />);
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /complete order/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      // Check that form element exists
      const form = document.querySelector("form");
      expect(form).toBeInTheDocument();
    });
  });

  describe("Form Fields", () => {
    it("fields have proper attributes", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const emailField = screen.getByLabelText(/email address/i);
      expect(emailField).toHaveAttribute("type", "email");
      expect(emailField).toHaveAttribute("name", "email");
      expect(emailField).toHaveAttribute("aria-invalid");

      const countryField = screen.getByLabelText(/country/i);
      expect(countryField).toHaveAttribute("name", "shippingCountry");
    });

    it("country field has options", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const countrySelect = screen.getByLabelText(/country/i);
      
      // The environment variable NEXT_PUBLIC_CHECKOUT_COUNTRIES is set to 'US,CA,GB,EU,RO' in jest.setup.ts
      // so we should expect these country codes as options, not full country names
      expect(screen.getByRole("option", { name: "US" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "CA" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "GB" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "EU" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "RO" })).toBeInTheDocument();
      
      // Also check for the default "Select country" option
      expect(screen.getByRole("option", { name: "Select country" })).toBeInTheDocument();
    });

    it("fields are focusable", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const emailField = screen.getByLabelText(/email address/i);
      await user.click(emailField);
      expect(emailField).toHaveFocus();
    });
  });

  describe("Billing Address Functionality", () => {
    it("same as shipping checkbox is checked by default", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/same as shipping address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const sameAsShippingCheckbox = screen.getByLabelText(/same as shipping address/i);
      expect(sameAsShippingCheckbox).toBeChecked();
    });

    it("shows billing address fields when same as shipping is unchecked", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/same as shipping address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const sameAsShippingCheckbox = screen.getByLabelText(/same as shipping address/i);
      await user.click(sameAsShippingCheckbox);

      // When unchecked, additional billing fields should appear
      const allNameFields = screen.getAllByLabelText(/full name/i);
      expect(allNameFields.length).toBeGreaterThan(1);
    });

    it("checkbox can be toggled", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/same as shipping address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const checkbox = screen.getByLabelText(/same as shipping address/i);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe("Form Submission", () => {
    it("submit button shows correct text", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /complete order/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const submitButton = screen.getByRole("button", { name: /complete order/i });
      expect(submitButton).toHaveTextContent("Complete Order with Card");
    });

    it("submit button has proper accessibility attributes", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /complete order/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const submitButton = screen.getByRole("button", { name: /complete order/i });
      expect(submitButton).toHaveAttribute("type", "submit");
      expect(submitButton).toHaveAttribute("aria-describedby");
    });

    it("button is disabled when form is empty", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /complete order/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const submitButton = screen.getByRole("button", { name: /complete order/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and descriptions", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute("aria-invalid");

      const submitButton = screen.getByRole("button", { name: /complete order/i });
      expect(submitButton).toHaveAttribute("aria-describedby");
    });

    it("form fields have proper IDs and labels", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const emailField = screen.getByLabelText(/email address/i);
      expect(emailField).toHaveAttribute("id");
      
      const nameField = screen.getByLabelText(/full name/i);
      expect(nameField).toHaveAttribute("id");
    });

    it("required fields are marked appropriately", async () => {
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Check for required field indicators
      expect(screen.getAllByText("*")).toHaveLength(6); // 6 required fields
    });
  });

  describe("Focus Management", () => {
    it("should maintain focus while typing in email field", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const emailInput = screen.getByLabelText(/email address/i);
      
      // Click on the email input
      await user.click(emailInput);
      
      // Type the full email address - this should not lose focus
      await user.type(emailInput, "alice@example.com");
      
      // Verify the complete value was entered
      expect(emailInput).toHaveValue("alice@example.com");
      
      // Verify the field still has focus (no focus lost during typing)
      expect(emailInput).toHaveFocus();
    });

    it("should maintain focus while typing in all form fields", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

      // Wait for form to render fully
      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const testFields = [
        { field: screen.getByLabelText(/email address/i), value: "john@example.com" },
        { field: screen.getByLabelText(/full name/i), value: "John Doe" },
        { field: screen.getByLabelText(/street address/i), value: "123 Main St" },
        { field: screen.getByLabelText(/city/i), value: "New York" },
        { field: screen.getByLabelText(/postal code/i), value: "10001" },
      ];

      for (const { field, value } of testFields) {
        // Click on the field
        await user.click(field);
        
        // Type the value - this should not lose focus
        await user.type(field, value);
        
        // Verify the complete value was entered
        expect(field).toHaveValue(value);
        
        // Verify typing didn't cause focus loss
        expect(field).toHaveFocus();
      }
    });
  });
}); 