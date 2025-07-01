import Hero from "@/components/Hero";
import Branding from "@/components/Branding";
import CustomerReviews from "@/components/CustomerReviews";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import ProductDetails from "@/components/ProductDetails";

export default function Home() {
  return (
    <>
      <Hero />
      <ProductDetails productId={1} />
      <Branding />
      <CustomerReviews />
      <FAQ />
      <Footer />
    </>
  );
}
