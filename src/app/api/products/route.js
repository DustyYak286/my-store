// Product API route handler (initial setup)

const products = require("./data");

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
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

  // Return all products if no id is specified
  return new Response(JSON.stringify(products), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// The GET endpoint will be implemented in the next step.
