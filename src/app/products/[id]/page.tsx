import ProductDetails from "@/components/ProductDetails";
import products, { Product } from "@/app/api/products/data";
import { notFound } from "next/navigation";

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const productId = parseInt(resolvedParams.id);
  const productData: Product | undefined = products.find(p => p.id === productId);

  // If product not found, trigger 404
  if (!productData) {
    notFound();
  }

  return <ProductDetails productData={productData} />;
}

// Generate static paths for all products at build time
export async function generateStaticParams() {
  return products.map((product) => ({
    id: product.id.toString(),
  }));
}
