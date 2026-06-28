"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationState = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  permission: PermissionState | null;
};

export type UseGeolocationResult = GeolocationState & {
  requestLocation: () => void;
  startWatching: () => void;
  stopWatching: () => void;
};

// Opciones de geolocalización solicitadas.
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

const ESTADO_INICIAL: GeolocationState = {
  lat: null,
  lng: null,
  accuracy: null,
  loading: false,
  error: null,
  permission: null,
};

// Mensajes en español para cada código de GeolocationPositionError.
function mensajeError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Permiso de ubicación denegado. Actívalo en la configuración del navegador.";
    case error.POSITION_UNAVAILABLE:
      return "No se pudo determinar tu ubicación. Verifica el GPS o la señal.";
    case error.TIMEOUT:
      return "Se agotó el tiempo para obtener tu ubicación. Inténtalo de nuevo.";
    default:
      return "Ocurrió un error desconocido al obtener tu ubicación.";
  }
}

// Verifica que el entorno permita geolocalización (navegador disponible y
// contexto seguro). Devuelve un mensaje de error, o null si todo está bien.
function verificarEntorno(): string | null {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return "La geolocalización no está disponible en este dispositivo.";
  }

  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "Se requiere una conexión segura (HTTPS) para usar la ubicación.";
  }

  return null;
}

export function useGeolocation(): UseGeolocationResult {
  const [state, setState] = useState<GeolocationState>(ESTADO_INICIAL);
  const watchIdRef = useRef<number | null>(null);

  // Consulta el estado del permiso vía Permissions API (si existe) y se
  // suscribe a sus cambios. NO solicita la ubicación.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }

    let activo = true;
    let status: PermissionStatus | null = null;

    const alCambiar = () => {
      if (activo && status) {
        setState((prev) => ({ ...prev, permission: status!.state }));
      }
    };

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (!activo) return;
        status = result;
        setState((prev) => ({ ...prev, permission: result.state }));
        result.addEventListener("change", alCambiar);
      })
      .catch(() => {
        // La consulta del permiso no es crítica; si falla, se ignora.
      });

    return () => {
      activo = false;
      status?.removeEventListener("change", alCambiar);
    };
  }, []);

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    setState((prev) => ({
      ...prev,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      loading: false,
      error: null,
    }));
  }, []);

  const onError = useCallback((error: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      loading: false,
      error: mensajeError(error),
    }));
  }, []);

  // Lectura puntual de la ubicación.
  const requestLocation = useCallback(() => {
    const errorEntorno = verificarEntorno();

    if (errorEntorno) {
      setState((prev) => ({ ...prev, loading: false, error: errorEntorno }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(onSuccess, onError, GEO_OPTIONS);
  }, [onSuccess, onError]);

  // Detiene el seguimiento y limpia el watchId.
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setState((prev) => ({ ...prev, loading: false }));
  }, []);

  // Inicia el seguimiento continuo (watchPosition).
  const startWatching = useCallback(() => {
    const errorEntorno = verificarEntorno();

    if (errorEntorno) {
      setState((prev) => ({ ...prev, loading: false, error: errorEntorno }));
      return;
    }

    // Evita múltiples watchers simultáneos.
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      GEO_OPTIONS
    );
  }, [onSuccess, onError]);

  // Limpia el watch automáticamente al desmontar.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    requestLocation,
    startWatching,
    stopWatching,
  };
}

export default useGeolocation;
