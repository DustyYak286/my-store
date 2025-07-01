"use client";

import ProductDetails from "@/components/ProductDetails";
import { useParams } from "next/navigation";

export default function ProductPage() {
  const { id } = useParams();

  return <ProductDetails productId={id} />;
}
