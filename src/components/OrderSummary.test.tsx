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
      expect(screen.getByLabelText("Price: $80.00")).toBeInTheDocument();
      // Should show original price crossed out
      expect(screen.getByLabelText("Original price: $100.00")).toBeInTheDocument();
      // Should show percentage off
      expect(screen.getByLabelText("20 percent off")).toBeInTheDocument();
    });

    it("displays correct pricing for items without discounts", () => {
      render(<OrderSummary />);

      expect(screen.getByLabelText("Price: $50.00")).toBeInTheDocument();
      // Should not show discount indicators
      expect(screen.queryByText("50% OFF")).not.toBeInTheDocument();
    });

    it("displays correct quantities", () => {
      render(<OrderSummary />);

      expect(screen.getByText("Qty: 2")).toBeInTheDocument();
      expect(screen.getByText("Qty: 1")).toBeInTheDocument();
    });

    it("calculates and displays item totals correctly", () => {
      render(<OrderSummary />);

      // Item 1: 80 * 2 = 160
      expect(screen.getByLabelText("Item total: $160.00")).toBeInTheDocument();
      // Item 2: 50 * 1 = 50 
      expect(screen.getByLabelText("Item total: $50.00")).toBeInTheDocument();
    });

    it("displays the order total", () => {
      render(<OrderSummary />);

      expect(screen.getByText("Order Total:")).toBeInTheDocument();
      expect(screen.getByLabelText("Order total: $210.00")).toBeInTheDocument();
    });

    it("displays correct item count", () => {
      render(<OrderSummary />);

      expect(screen.getByText("2 items in your order")).toBeInTheDocument();
    });

    it("renders product images with proper attributes", () => {
      render(<OrderSummary />);

      // Images with alt="" have presentation role, not img role
      const images = screen.getAllByRole("presentation");
      // Filter to only img elements (exclude the SVG icon)
      const imgElements = images.filter(el => el.tagName === 'IMG');
      expect(imgElements).toHaveLength(2);
      
      imgElements.forEach(img => {
        expect(img).toHaveAttribute("loading", "lazy");
        expect(img).toHaveAttribute("alt", "");
      });
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

      expect(screen.getByText("1 item in your order")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      (useCart as jest.Mock).mockReturnValue({
        cartItems: [mockCartItem],
        totalPrice: 160,
      });
    });

    it("has proper region role and label", () => {
      render(<OrderSummary />);

      const summaryRegion = screen.getByRole("region");
      expect(summaryRegion).toHaveAttribute("aria-label", "Order summary");
    });

    it("has proper article structure for cart items", () => {
      render(<OrderSummary />);

      const articles = screen.getAllByRole("article");
      expect(articles).toHaveLength(1);
      expect(articles[0]).toHaveAttribute("aria-label", "Test Product, quantity 2");
    });

    it("has proper ARIA labels for prices", () => {
      render(<OrderSummary />);

      expect(screen.getByLabelText("Price: $80.00")).toBeInTheDocument();
      expect(screen.getByLabelText("Original price: $100.00")).toBeInTheDocument();
      expect(screen.getByLabelText("20 percent off")).toBeInTheDocument();
      expect(screen.getByLabelText("Item total: $160.00")).toBeInTheDocument();
      expect(screen.getByLabelText("Order total: $160.00")).toBeInTheDocument();
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

    it("has responsive class names for different screen sizes", () => {
      render(<OrderSummary />);

      // Check for responsive text sizes
      const heading = screen.getByText("Order Total:");
      expect(heading).toHaveClass("text-lg", "lg:text-xl");

      // Use specific aria-label to avoid ambiguity
      const orderTotal = screen.getByLabelText("Order total: $160.00");
      expect(orderTotal).toHaveClass("text-xl", "lg:text-2xl");
    });

    it("has responsive image sizes", () => {
      render(<OrderSummary />);

      // Images with alt="" have presentation role, get the first image
      const images = screen.getAllByRole("presentation");
      const image = images.find(el => el.tagName === 'IMG');
      expect(image).toHaveClass("w-16", "h-16", "lg:w-20", "lg:h-20");
    });
  });
}); 