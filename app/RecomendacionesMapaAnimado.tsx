"use client";

import { useEffect, useMemo } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";
import {
  recomendacionesCircuitoNorte,
  type RecomendacionCircuitoNorte,
  type TipoRecomendacion,
} from "./data/recomendacionesCircuitoNorte";

type Position = [number, number];

type PuntoCercano = {
  lat: number;
  lng: number;
};

export type DiagnosticoRecomendaciones = {
  total: number;
  activas: boolean;
  distanciaMasCercanaMetros: number | null;
};

type RecomendacionesMapaAnimadoProps = {
  active: boolean;
  rutaSeleccionada: string;
  userPosition: Position | null;
  buses: PuntoCercano[];
  testMode?: boolean;
  onDiagnosticChange?: (diagnostico: DiagnosticoRecomendaciones) => void;
};

const RADIO_RECOMENDACION_METROS = 100;
const MAX_POPUPS_VISIBLES = 3;

function obtenerEmojiTipo(tipo: TipoRecomendacion) {
  if (tipo === "tacos") return "🌮";
  if (tipo === "cafe") return "☕";
  if (tipo === "tienda") return "🛍️";
  if (tipo === "conveniencia") return "🏪";

  return "🍽️";
}

function distanciaHaversineMetros(a: Position, b: Position) {
  const radioTierraMetros = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return radioTierraMetros * c;
}

function crearMarcadorNegocioIcon(recomendacion: RecomendacionCircuitoNorte) {
  return new L.DivIcon({
    html: `
      <div class="rt-recommendation-marker" aria-hidden="true">
        <span>${obtenerEmojiTipo(recomendacion.tipo)}</span>
      </div>
    `,
    className: "",
    iconSize: [42, 42],
    iconAnchor: [21, 36],
  });
}

function crearPopupRecomendacionIcon(
  recomendacion: RecomendacionCircuitoNorte,
  distanciaMetros: number
) {
  const distancia = Number.isFinite(distanciaMetros)
    ? `A ${Math.max(1, Math.round(distanciaMetros))} m`
    : "Modo prueba";

  return new L.DivIcon({
    html: `
      <div class="rt-recommendation-popup-card" aria-hidden="true">
        <strong>${obtenerEmojiTipo(recomendacion.tipo)} ${recomendacion.nombre}</strong>
        <span>${recomendacion.precio} barato</span>
        <span>${recomendacion.calidad} rico</span>
        <small>${distancia}</small>
      </div>
    `,
    className: "",
    iconSize: [190, 118],
    iconAnchor: [95, 118],
  });
}

export default function RecomendacionesMapaAnimado({
  active,
  rutaSeleccionada,
  userPosition,
  buses,
  testMode = false,
  onDiagnosticChange,
}: RecomendacionesMapaAnimadoProps) {
  const esCircuitoNorte = rutaSeleccionada
    .toLowerCase()
    .includes("circuito norte");

  const puntosReferencia = useMemo(() => {
    const puntos = buses
      .filter((bus) => Number.isFinite(bus.lat) && Number.isFinite(bus.lng))
      .map((bus): Position => [bus.lat, bus.lng]);

    if (userPosition) puntos.unshift(userPosition);

    return puntos;
  }, [buses, userPosition]);

  const recomendacionesConDistancia = useMemo(() => {
    if (!active || !esCircuitoNorte) return [];

    return recomendacionesCircuitoNorte
      .map((recomendacion) => {
        const posicionRecomendacion: Position = [
          recomendacion.lat,
          recomendacion.lng,
        ];
        const distanciaMinima =
          puntosReferencia.length > 0
            ? Math.min(
                ...puntosReferencia.map((punto) =>
                  distanciaHaversineMetros(punto, posicionRecomendacion)
                )
              )
            : Number.POSITIVE_INFINITY;

        return {
          recomendacion,
          distanciaMetros: distanciaMinima,
        };
      })
      .sort((a, b) => a.distanciaMetros - b.distanciaMetros);
  }, [active, esCircuitoNorte, puntosReferencia]);

  const distanciaMasCercanaMetros =
    recomendacionesConDistancia[0]?.distanciaMetros ?? null;
  const recomendacionesCercanas = testMode
    ? recomendacionesConDistancia.slice(0, recomendacionesCircuitoNorte.length)
    : recomendacionesConDistancia
        .filter(
          (item) => item.distanciaMetros <= RADIO_RECOMENDACION_METROS
        )
        .slice(0, MAX_POPUPS_VISIBLES);

  useEffect(() => {
    onDiagnosticChange?.({
      total: recomendacionesCircuitoNorte.length,
      activas: active,
      distanciaMasCercanaMetros: Number.isFinite(distanciaMasCercanaMetros ?? NaN)
        ? distanciaMasCercanaMetros
        : null,
    });
  }, [active, distanciaMasCercanaMetros, onDiagnosticChange]);

  if (!active || !esCircuitoNorte) return null;

  return (
    <>
      {recomendacionesCircuitoNorte.map((recomendacion) => (
        <Marker
          key={recomendacion.id}
          position={[recomendacion.lat, recomendacion.lng]}
          icon={crearMarcadorNegocioIcon(recomendacion)}
          interactive={false}
        />
      ))}

      {recomendacionesCercanas.map((item) => (
          <Marker
            key={`popup-${item.recomendacion.id}`}
            position={[item.recomendacion.lat, item.recomendacion.lng]}
            icon={crearPopupRecomendacionIcon(
              item.recomendacion,
              item.distanciaMetros
            )}
            interactive={false}
            zIndexOffset={1500}
          />
        ))}
    </>
  );
}
