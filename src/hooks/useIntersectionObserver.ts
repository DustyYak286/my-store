import { useEffect, useRef, useState } from "react";

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
}

// Overloaded hook signatures for different use cases
export function useIntersectionObserver(
  options?: UseIntersectionObserverOptions
): { elementRef: React.RefObject<HTMLElement>; isIntersecting: boolean };

export function useIntersectionObserver(
  externalRef: React.RefObject<HTMLElement | null>,
  options?: UseIntersectionObserverOptions
): { isIntersecting: boolean };

export function useIntersectionObserver(
  optionsOrRef?: UseIntersectionObserverOptions | React.RefObject<HTMLElement | null>,
  options?: UseIntersectionObserverOptions
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const internalRef = useRef<HTMLElement | null>(null);
  
  // Determine if first argument is a ref or options
  const isExternalRef = optionsOrRef && 'current' in optionsOrRef;
  const elementRef = isExternalRef ? optionsOrRef as React.RefObject<HTMLElement | null> : internalRef;
  const finalOptions: UseIntersectionObserverOptions = isExternalRef 
    ? options || {} 
    : (optionsOrRef as UseIntersectionObserverOptions) || {};

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      {
        threshold: finalOptions.threshold || 0,
        rootMargin: finalOptions.rootMargin || "0px",
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef, finalOptions.threshold, finalOptions.rootMargin]);

  return isExternalRef 
    ? { isIntersecting }
    : { elementRef, isIntersecting };
} 