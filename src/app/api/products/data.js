// Initial product data for the Product API

const products = [
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

module.exports = products;
