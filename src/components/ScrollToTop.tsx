import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Attendre un petit délai pour s'assurer que le contenu est bien rendu
    const timeout = setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth", // défilement fluide
      });
    }, 100);

    return () => clearTimeout(timeout);
  }, [pathname, search]); // inclut aussi les changements de ?query

  return null;
};
