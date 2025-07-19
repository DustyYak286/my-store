// Individual product API route handler - Returns a single product object

const products = require("../data");

export async function GET(request, { params }) {
  const { id } = params;
  
  // Find the product by ID
  const product = products.find((p) => String(p.id) === String(id));
  
  if (product) {
    return new Response(JSON.stringify(product), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else {
    return new Response(JSON.stringify({ error: "Product not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
} 