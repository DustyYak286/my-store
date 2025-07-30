import Hero from "@/components/Hero";
import Branding from "@/components/Branding";
import CustomerReviews from "@/components/CustomerReviews";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import ProductDetails from "@/components/ProductDetails";
import products, { Product } from "@/app/api/products/data";

export default function Home() {
  // Get the main product (ID: 1) at build time
  const mainProduct: Product | undefined = products.find(p => p.id === 1);

  return (
    <>
      <Hero productData={mainProduct || null} />
      <ProductDetails productData={mainProduct || null} />
      <Branding />
      <CustomerReviews />
      <FAQ />
      <Footer />
    </>
  );
}