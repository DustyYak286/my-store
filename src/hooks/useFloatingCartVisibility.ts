import { usePathname } from "next/navigation";
import { useIntersectionObserver } from "./useIntersectionObserver";

interface UseFloatingCartVisibilityProps {
  navbarRef: React.RefObject<HTMLElement>;
}

export const useFloatingCartVisibility = ({ navbarRef }: UseFloatingCartVisibilityProps) => {
  const { isIntersecting: isNavbarVisible } = useIntersectionObserver(navbarRef);
  const pathname = usePathname();
  
  // Hide button on checkout page (consistent with Navbar behavior)
  const isCheckoutPage = pathname === '/checkout';
  
  // Show button when navbar is not visible and not on checkout page
  const shouldShowButton = !isNavbarVisible && !isCheckoutPage;
  
  return {
    shouldShowButton,
    isNavbarVisible,
    isCheckoutPage,
  };
}; 