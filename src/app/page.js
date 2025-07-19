import Hero from "@/components/Hero";
import Branding from "@/components/Branding";
import CustomerReviews from "@/components/CustomerReviews";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import ProductDetails from "@/components/ProductDetails";
import products from "@/app/api/products/data.js";

export default function Home() {
  // Get the main product (ID: 1) at build time
  const mainProduct = products.find(p => p.id === 1);

  return (
    <>
      <Hero productData={mainProduct} />
      <ProductDetails productData={mainProduct} />
      <Branding />
      <CustomerReviews />
      <FAQ />
      <Footer />
    </>
  );
}
