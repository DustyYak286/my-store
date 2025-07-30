// Product API route handler - Returns all products as an array

import products, { Product } from "./data";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse<Product[]>> {
  try {
    // Always return all products as an array
    return NextResponse.json(products, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json([], {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}