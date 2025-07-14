import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import CheckoutForm from "./CheckoutForm";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/useToast";

// Mock the dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/context/CartContext", () => ({
  useCart: jest.fn(),
}));

jest.mock("@/hooks/useToast", () => ({
  useToast: jest.fn(),
}));

// Mock router
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
};

// Mock cart context
const mockClearCart = jest.fn();
const mockCartContext = {
  clearCart: mockClearCart,
};

// Mock toast hook
const mockShowToast = jest.fn();
const mockHideToast = jest.fn();
const mockToastHook = {
  toast: { message: "", isVisible: false, type: "success" as const },
  showToast: mockShowToast,
  hideToast: mockHideToast,
};

describe("CheckoutForm", () => {
  beforeEach(() => {
    // Setup mocks
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useCart as jest.Mock).mockReturnValue(mockCartContext);
    (useToast as jest.Mock).mockReturnValue(mockToastHook);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("Form Rendering", () => {
    it("renders all required form sections", () => {
      render(<CheckoutForm />);

      expect(screen.getByText("Contact Information")).toBeInTheDocument();
      expect(screen.getByText("Shipping Address")).toBeInTheDocument();
      expect(screen.getByText("Billing Address")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /place order/i })).toBeInTheDocument();
    });

    it("renders all required form fields", () => {
      render(<CheckoutForm />);

      // Contact Information
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();

      // Shipping Address
      expect(screen.getByLabelText(/^full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^street address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^city/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^postal code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^country/i)).toBeInTheDocument();

      // Billing Address
      expect(screen.getByLabelText(/same as shipping address/i)).toBeInTheDocument();
    });

    it("renders submit button as disabled by default", () => {
      render(<CheckoutForm />);

      const submitButton = screen.getByRole("button", { name: /place order/i });
      expect(submitButton).toBeDisabled();
    });

    it("shows help text for disabled button", () => {
      render(<CheckoutForm />);

      expect(screen.getByText("Please fill in all required fields to place your order")).toBeInTheDocument();
    });

    it("has proper form structure", () => {
      render(<CheckoutForm />);

      // Check that form element exists
      const form = document.querySelector("form");
      expect(form).toBeInTheDocument();
    });
  });

  describe("Form Fields", () => {
    it("fields have proper attributes", async () => {
      render(<CheckoutForm />);

      const emailField = screen.getByLabelText(/email address/i);
      expect(emailField).toHaveAttribute("type", "email");
      expect(emailField).toHaveAttribute("name", "email");
      expect(emailField).toHaveAttribute("aria-invalid");

      const countryField = screen.getByLabelText(/^country/i);
      expect(countryField).toHaveAttribute("name", "shippingCountry");
    });

    it("country field has options", async () => {
      render(<CheckoutForm />);

      const countrySelect = screen.getByLabelText(/^country/i);
      expect(screen.getByRole("option", { name: "United States" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Canada" })).toBeInTheDocument();
    });

    it("fields are focusable", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

      const emailField = screen.getByLabelText(/email address/i);
      await user.click(emailField);
      expect(emailField).toHaveFocus();
    });
  });

  describe("Billing Address Functionality", () => {
    it("same as shipping checkbox is checked by default", () => {
      render(<CheckoutForm />);

      const sameAsShippingCheckbox = screen.getByLabelText(/same as shipping address/i);
      expect(sameAsShippingCheckbox).toBeChecked();
    });

    it("shows billing address fields when same as shipping is unchecked", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

      const sameAsShippingCheckbox = screen.getByLabelText(/same as shipping address/i);
      await user.click(sameAsShippingCheckbox);

      // When unchecked, additional billing fields should appear
      const allNameFields = screen.getAllByLabelText(/^full name/i);
      expect(allNameFields.length).toBeGreaterThan(1);
    });

    it("checkbox can be toggled", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

      const checkbox = screen.getByLabelText(/same as shipping address/i);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe("Form Submission", () => {
    it("submit button shows correct text", () => {
      render(<CheckoutForm />);

      const submitButton = screen.getByRole("button", { name: /place order/i });
      expect(submitButton).toHaveTextContent("Place Order");
    });

    it("submit button has proper accessibility attributes", () => {
      render(<CheckoutForm />);

      const submitButton = screen.getByRole("button", { name: /place order/i });
      expect(submitButton).toHaveAttribute("type", "submit");
      expect(submitButton).toHaveAttribute("aria-describedby");
    });

    it("button is disabled when form is empty", () => {
      render(<CheckoutForm />);

      const submitButton = screen.getByRole("button", { name: /place order/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and descriptions", () => {
      render(<CheckoutForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute("aria-invalid");

      const submitButton = screen.getByRole("button", { name: /place order/i });
      expect(submitButton).toHaveAttribute("aria-describedby");
    });

    it("form fields have proper IDs and labels", () => {
      render(<CheckoutForm />);

      const emailField = screen.getByLabelText(/email address/i);
      expect(emailField).toHaveAttribute("id");
      
      const nameField = screen.getByLabelText(/^full name/i);
      expect(nameField).toHaveAttribute("id");
    });

    it("required fields are marked appropriately", () => {
      render(<CheckoutForm />);

      // Check for required field indicators
      expect(screen.getAllByText("*")).toHaveLength(6); // 6 required fields
    });
  });

  describe("Focus Management", () => {
    it("should maintain focus while typing in email field", async () => {
      const user = userEvent.setup();
      render(<CheckoutForm />);

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

      const testFields = [
        { field: screen.getByLabelText(/email address/i), value: "john@example.com" },
        { field: screen.getByLabelText(/^full name/i), value: "John Doe" },
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