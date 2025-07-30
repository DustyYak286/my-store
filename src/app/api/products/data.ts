// Product data types and initial data for the Product API

export interface ProductPrice {
  original: number;
  discount?: number;
  currency: string;
}

export interface ProductStock {
  available: boolean;
  quantity: number;
}

export interface ProductReview {
  rating: number;
  text: string;
  author: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: ProductPrice;
  image: string;
  stock: ProductStock;
  reviews: ProductReview[];
}

const products: Product[] = [
  {
    id: 1,
    name: "Capybara Bracelet",
    description:
      "A beautiful handcrafted bracelet featuring adorable capybara charms. Made with high-quality materials and perfect for any occasion.",
    price: {
      original: 14.99,
      discount: 9.99,
      currency: "USD",
    },
    image: "/images/capybara-product-section.png",
    stock: {
      available: true,
      quantity: 42,
    },
    reviews: [
      {
        rating: 5,
        text: "Absolutely love this bracelet! The capybara charms are so cute.",
        author: "Alice",
      },
      {
        rating: 4,
        text: "Great quality and fast shipping.",
        author: "Bob",
      },
    ],
  },
  // Add more products as needed
];

export default products;