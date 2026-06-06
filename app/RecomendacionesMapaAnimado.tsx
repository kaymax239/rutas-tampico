"use client";

import { useMemo } from "react";
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

type RecomendacionesMapaAnimadoProps = {
  active: boolean;
  rutaSeleccionada: string;
  userPosition: Position | null;
  buses: PuntoCercano[];
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
  const distancia = Math.max(1, Math.round(distanciaMetros));

  return new L.DivIcon({
    html: `
      <div class="rt-recommendation-popup-card" aria-hidden="true">
        <strong>${obtenerEmojiTipo(recomendacion.tipo)} ${recomendacion.nombre}</strong>
        <span>${recomendacion.precio} barato</span>
        <span>${recomendacion.calidad} rico</span>
        <small>A ${distancia} m</small>
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

  const recomendacionesCercanas = useMemo(() => {
    if (!active || !esCircuitoNorte || puntosReferencia.length === 0) {
      return [];
    }

    return recomendacionesCircuitoNorte
      .map((recomendacion) => {
        const posicionRecomendacion: Position = [
          recomendacion.lat,
          recomendacion.lng,
        ];
        const distanciaMinima = Math.min(
          ...puntosReferencia.map((punto) =>
            distanciaHaversineMetros(punto, posicionRecomendacion)
          )
        );

        return {
          recomendacion,
          distanciaMetros: distanciaMinima,
        };
      })
      .filter(
        (item) => item.distanciaMetros <= RADIO_RECOMENDACION_METROS
      )
      .sort((a, b) => a.distanciaMetros - b.distanciaMetros)
      .slice(0, MAX_POPUPS_VISIBLES);
  }, [active, esCircuitoNorte, puntosReferencia]);



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
