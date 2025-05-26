import Hero from '@/components/Hero';
import ProductDetails from '@/components/ProductDetails';
import Branding from '@/components/Branding';
import CustomerReviews from '@/components/CustomerReviews';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Hero />
      <ProductDetails />
      <Branding />
      <CustomerReviews />
      <FAQ />
      <Footer />
    </>
  );
}
