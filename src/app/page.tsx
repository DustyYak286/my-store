import dynamic from "next/dynamic";
import { Suspense } from "react";
import Hero from "@/components/Hero";
import ProductDetails from "@/components/ProductDetails";
import { LazyLoadErrorBoundary } from "@/components/LazyLoadErrorBoundary";
import products, { Product } from "@/app/api/products/data";

// Lazy load non-critical components that appear below the fold
const Branding = dynamic(() => import("@/components/Branding"), {
  loading: () => <BrandingSkeleton />
});

const CustomerReviews = dynamic(() => import("@/components/CustomerReviews"), {
  loading: () => <ReviewsSkeleton />
});

const FAQ = dynamic(() => import("@/components/FAQ"), {
  loading: () => <FAQSkeleton />
});

const Footer = dynamic(() => import("@/components/Footer"), {
  loading: () => <FooterSkeleton />
});

function BrandingSkeleton() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center space-y-4">
                <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewsSkeleton() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow space-y-4">
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <div key={star} className="h-4 w-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSkeleton() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
          <div className="max-w-3xl mx-auto space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg p-6">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FooterSkeleton() {
  return (
    <footer className="bg-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div className="h-24 bg-gray-700 rounded"></div>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  // Get the main product (ID: 1) at build time
  const mainProduct: Product | undefined = products.find(p => p.id === 1);

  return (
    <>
      <Hero productData={mainProduct || null} />
      <ProductDetails productData={mainProduct || null} />
      <Suspense fallback={<BrandingSkeleton />}>
        <LazyLoadErrorBoundary componentName="Branding" fallback={<BrandingSkeleton />}>
          <Branding />
        </LazyLoadErrorBoundary>
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <LazyLoadErrorBoundary componentName="CustomerReviews" fallback={<ReviewsSkeleton />}>
          <CustomerReviews />
        </LazyLoadErrorBoundary>
      </Suspense>
      <Suspense fallback={<FAQSkeleton />}>
        <LazyLoadErrorBoundary componentName="FAQ" fallback={<FAQSkeleton />}>
          <FAQ />
        </LazyLoadErrorBoundary>
      </Suspense>
      <Suspense fallback={<FooterSkeleton />}>
        <LazyLoadErrorBoundary componentName="Footer" fallback={<FooterSkeleton />}>
          <Footer />
        </LazyLoadErrorBoundary>
      </Suspense>
    </>
  );
}