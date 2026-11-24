import { useEffect, useRef } from "react";

/**
 * Fournit un conteneur <div> DÉDIÉ (ajouté à <body>) pour un createPortal.
 *
 * Pourquoi : plusieurs composants portaient directement dans `document.body`
 * (overlay de séance guidée, notifications flottantes…). Quand deux portails
 * montent/démontent en même temps dans le même body, React peut appeler
 * insertBefore/removeChild sur un nœud qu'un autre portail a déplacé →
 * « NotFoundError: The object can not be found here. » (crash intermittent,
 * typiquement pendant une séance avec le chrono qui se re-rend chaque seconde).
 *
 * En donnant à chaque portail son propre conteneur isolé, la réconciliation de
 * l'un ne peut plus casser celle de l'autre.
 */
export function usePortalContainer(id?: string): HTMLElement | null {
  const ref = useRef<HTMLElement | null>(null);

  if (ref.current === null && typeof document !== "undefined") {
    const el = document.createElement("div");
    if (id) el.setAttribute("data-portal", id);
    ref.current = el;
  }

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof document === "undefined") return;
    document.body.appendChild(el);
    return () => {
      try {
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch {
        /* déjà retiré */
      }
    };
  }, []);

  return ref.current;
}
