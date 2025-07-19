// Product API route handler - Returns all products as an array

const products = require("./data");

export async function GET(request) {
  // Always return all products as an array
  return new Response(JSON.stringify(products), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
