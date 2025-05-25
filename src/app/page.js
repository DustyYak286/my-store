import Link from 'next/link';
import { PRODUCT } from '@/constants/store';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight text-analenn-primary sm:text-6xl">
          {PRODUCT.NAME}
        </h1>
        <p className="text-lg leading-8 text-analenn-secondary max-w-2xl mx-auto">
          {PRODUCT.DESCRIPTION}
        </p>
        <div className="flex items-center justify-center gap-x-6">
          <Link
            href="/product"
            className="rounded-md bg-analenn-primary px-3.5 py-2.5 text-sm font-semibold text-analenn-white shadow-sm hover:bg-analenn-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-analenn-primary"
          >
            View Product
          </Link>
          <Link
            href="/product"
            className="text-sm font-semibold leading-6 text-analenn-accent hover:text-analenn-primary"
          >
            Learn more <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
