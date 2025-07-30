// Individual product API route handler - Returns a single product object

import products, { Product } from "../data";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<Product | { error: string }>> {
  try {
    const { id } = await params;

    // Find the product by ID
    const product = products.find((p) => String(p.id) === String(id));

    if (product) {
      return NextResponse.json(product, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } else {
      return NextResponse.json(
        { error: "Product not found" },
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}