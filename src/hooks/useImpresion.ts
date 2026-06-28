"use client";

import { useCallback, useEffect, useRef } from "react";

// Opciones de la regla de impresión.
type OpcionesImpresion = {
  umbral?: number; // fracción visible mínima (0.5 = 50%)
  tiempoMs?: number; // tiempo continuo visible requerido
  activo?: boolean; // si es false, no observa nada
};

// Detecta una "impresión": el elemento estuvo al menos `umbral` visible durante
// `tiempoMs` continuos. Dispara onImpresion() UNA sola vez por montaje.
// Solo detecta; no sabe de Firestore ni de deduplicación.
export function useImpresion(
  onImpresion: () => void,
  opciones?: OpcionesImpresion
): (nodo: Element | null) => void {
  const { umbral = 0.5, tiempoMs = 1000, activo = true } = opciones ?? {};

  // Refs estables para no recrear el observer en cada render.
  const onImpresionRef = useRef(onImpresion);
  const nodoRef = useRef<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yaRegistradaRef = useRef(false);

  // Mantiene el callback más reciente sin reconstruir el observer.
  useEffect(() => {
    onImpresionRef.current = onImpresion;
  }, [onImpresion]);

  // Cancela el conteo pendiente (el elemento salió antes de cumplir el tiempo).
  const limpiarTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Desconecta el observer y limpia el timeout.
  const desconectar = useCallback(() => {
    limpiarTimeout();
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, [limpiarTimeout]);

  // (Re)crea el observer para el nodo actual. Se llama desde la ref callback
  // y cuando cambian las opciones.
  const observar = useCallback(() => {
    desconectar();

    const nodo = nodoRef.current;

    // Sin nodo, inactivo, ya registrada o sin soporte: no observa.
    if (
      !nodo ||
      !activo ||
      yaRegistradaRef.current ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const visible =
          entry.isIntersecting && entry.intersectionRatio >= umbral;

        if (visible) {
          // Arranca el conteo solo si no está ya corriendo.
          if (timeoutRef.current === null) {
            timeoutRef.current = setTimeout(() => {
              timeoutRef.current = null;
              if (yaRegistradaRef.current) return;
              yaRegistradaRef.current = true;
              desconectar();
              onImpresionRef.current();
            }, tiempoMs);
          }
        } else {
          // Salió antes de cumplir el tiempo: cancela el conteo.
          limpiarTimeout();
        }
      },
      // Dos thresholds (entrada en 0 y en `umbral`) para una detección de
      // entrada/salida más confiable entre navegadores.
      { threshold: [0, umbral] }
    );

    observer.observe(nodo);
    observerRef.current = observer;
  }, [activo, umbral, tiempoMs, desconectar, limpiarTimeout]);

  // Ref callback que el componente asigna al elemento a observar.
  // Al cambiar el nodo (incluido pasar a null), re-observa o limpia.
  const refImpresion = useCallback(
    (nodo: Element | null) => {
      nodoRef.current = nodo;
      observar();
    },
    [observar]
  );

  // Re-observa si cambian las opciones; limpia al desmontar.
  useEffect(() => {
    observar();
    return () => {
      desconectar();
    };
  }, [observar, desconectar]);

  return refImpresion;
}

export default useImpresion;
