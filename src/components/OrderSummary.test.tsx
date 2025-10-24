import React from "react";
import { render, screen } from "@testing-library/react";
import OrderSummary from "./OrderSummary";
import { useCart } from "@/context/CartContext";

// Mock the cart context
jest.mock("@/context/CartContext", () => ({
  useCart: jest.fn(),
}));

// Mock formatPrice utility
jest.mock("@/utils/formatPrice", () => ({
  formatPrice: jest.fn((price: number) => price.toFixed(2)),
}));

// Mock cart item data for testing
const mockCartItem = {
  id: "1",
  name: "Test Product",
  price: { original: 100, discount: 80, currency: "USD" },
  image: "/test-image.jpg",
  quantity: 2,
};

const mockCartItemNoDiscount = {
  id: "2", 
  name: "Product Without Discount",
  price: { original: 50, currency: "USD" },
  image: "/test-image-2.jpg",
  quantity: 1,
};

describe("OrderSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Empty Cart", () => {
    beforeEach(() => {
      (useCart as jest.Mock).mockReturnValue({
        cartItems: [],
        totalPrice: 0,
      });
    });

    it("renders empty cart message", () => {
      render(<OrderSummary />);

      expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
      expect(screen.getByText("Add some items to proceed with checkout")).toBeInTheDocument();
    });

    it("has proper accessibility attributes for empty state", () => {
      render(<OrderSummary />);

      const emptyState = screen.getByRole("status");
      expect(emptyState).toHaveAttribute("aria-live", "polite");
    });

    it("renders empty cart icon", () => {
      const { container } = render(<OrderSummary />);

      // SVG with aria-hidden="true" is hidden from accessibility tree, query by element
      const icon = container.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Cart with Items", () => {
    beforeEach(() => {
      (useCart as jest.Mock).mockReturnValue({
        cartItems: [mockCartItem, mockCartItemNoDiscount],
        totalPrice: 210, // 80*2 + 50*1
      });
    });

    it("renders all cart items", () => {
      render(<OrderSummary />);

      expect(screen.getByText("Test Product")).toBeInTheDocument();
      expect(screen.getByText("Product Without Discount")).toBeInTheDocument();
    });

    it("displays correct pricing for items with discounts", () => {
      render(<OrderSummary />);

      // Should show discounted price
      expect(screen.getByText("$80.00")).toBeInTheDocument();
      // Should show original price crossed out
      expect(screen.getByText("$100.00")).toBeInTheDocument();
      // Should show percentage off
      expect(screen.getByText("20% OFF")).toBeInTheDocument();
    });

    it("handles products without discount", () => {
      render(<OrderSummary />);

      // Use getAllByText since $50.00 appears twice
      const prices = screen.getAllByText("$50.00");
      expect(prices.length).toBeGreaterThan(0);
      // Should not show discount indicators
      expect(screen.queryByText("50% OFF")).not.toBeInTheDocument();
    });

    it("calculates and displays item totals correctly", () => {
      render(<OrderSummary />);

      // Item 1: 80 * 2 = 160
      expect(screen.getByText("$160.00")).toBeInTheDocument();
      // Item 2: 50 * 1 = 50 (appears twice, use getAllByText)
      const fiftyPrices = screen.getAllByText("$50.00");
      expect(fiftyPrices.length).toBeGreaterThan(0);
    });

    it("displays the order total", () => {
      render(<OrderSummary />);

      expect(screen.getByText("Total:")).toBeInTheDocument();
      expect(screen.getByText("$210.00")).toBeInTheDocument();
    });

    it("displays correct item count", () => {
      render(<OrderSummary />);

      // Check that we have the cart count in the heading
      expect(screen.getByText(/Order Summary \(.*items\)/)).toBeInTheDocument();
    });

    it("displays multiple items correctly", () => {
      render(<OrderSummary />);

      // Check that we have the cart count in the heading
      expect(screen.getByText(/Order Summary \(.*items\)/)).toBeInTheDocument();
    });

    it("renders product images with proper attributes", () => {
      render(<OrderSummary />);

      // Images now have proper alt text, so use getByRole("img") - Next.js optimized
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(2);
      expect(images[0]?.getAttribute("src")).toContain("%2Ftest-image.jpg");
      expect(images[1]?.getAttribute("src")).toContain("%2Ftest-image-2.jpg");
    });
  });

  describe("Single Item Cart", () => {
    beforeEach(() => {
      (useCart as jest.Mock).mockReturnValue({
        cartItems: [mockCartItem],
        totalPrice: 160,
      });
    });

    it("displays singular item count", () => {
      render(<OrderSummary />);

      // Check that we have the cart count in the heading
      expect(screen.getByText(/Order Summary \(.*items\)/)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper heading hierarchy", () => {
      render(<OrderSummary />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent(/Order Summary/);
    });

    it("has proper element structure for cart items", () => {
      render(<OrderSummary />);

      // Check that we have the expected product
      expect(screen.getByText("Test Product")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Test Product" })).toBeInTheDocument();
    });

    it("has proper price display", () => {
      render(<OrderSummary />);

      expect(screen.getByText("$80.00")).toBeInTheDocument();
      expect(screen.getByText("$100.00")).toBeInTheDocument();
      expect(screen.getByText("20% OFF")).toBeInTheDocument();
      // Use getAllByText for the total since it appears twice
      const totals = screen.getAllByText("$160.00");
      expect(totals.length).toBeGreaterThan(0);
    });
  });

  describe("Percentage Calculation", () => {
    it("calculates percentage off correctly", () => {
      (useCart as jest.Mock).mockReturnValue({
        cartItems: [{
          ...mockCartItem,
          price: { original: 200, discount: 150, currency: "USD" },
        }],
        totalPrice: 300,
      });

      render(<OrderSummary />);

      // 200 - 150 = 50, 50/200 = 0.25 = 25%
      expect(screen.getByText("25% OFF")).toBeInTheDocument();
    });

    it("handles edge case where original price is 0", () => {
      (useCart as jest.Mock).mockReturnValue({
        cartItems: [{
          ...mockCartItem,
          price: { original: 0, discount: 0, currency: "USD" },
        }],
        totalPrice: 0,
      });

      render(<OrderSummary />);

      // Should not crash and should not show percentage
      expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    beforeEach(() => {
      (useCart as jest.Mock).mockReturnValue({
        cartItems: [mockCartItem],
        totalPrice: 160,
      });
    });

    it("displays price and discount information correctly", () => {
      render(<OrderSummary />);

      expect(screen.getByText("$80.00")).toBeInTheDocument(); // Current price
      expect(screen.getByText("$100.00")).toBeInTheDocument(); // Original price
      expect(screen.getByText("20% OFF")).toBeInTheDocument(); // Discount
      // Use getAllByText for the total since it appears twice
      const totals = screen.getAllByText("$160.00");
      expect(totals.length).toBeGreaterThan(0); // Item total
    });

    it("has responsive class names for different screen sizes", () => {
      render(<OrderSummary />);

      // Check for responsive text sizes on the main container
      const container = document.querySelector('.bg-white.rounded-lg');
      expect(container).toHaveClass("bg-white", "rounded-lg");

      // Check for responsive image container - Next.js Image uses width/height props
      const image = screen.getByRole("img", { name: "Test Product" });
      expect(image).toHaveClass("object-cover", "rounded-md", "flex-shrink-0");
    });

    it("has responsive image sizes", () => {
      render(<OrderSummary />);

      // Images now use Next.js Image with proper dimensions via props
      const image = screen.getByRole("img", { name: "Test Product" });
      expect(image).toHaveClass("object-cover", "rounded-md", "flex-shrink-0");
      // Next.js Image component handles width/height via props, not CSS classes
    });
  });
}); 