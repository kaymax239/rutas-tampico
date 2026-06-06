"use client";

import { useEffect, useMemo } from "react";
import { Marker, useMap } from "react-leaflet";
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
  popupsVisibles: number;
};

type RecomendacionesMapaAnimadoProps = {
  active: boolean;
  rutaSeleccionada: string;
  userPosition: Position | null;
  buses: PuntoCercano[];
  testMode?: boolean;
  demoMode?: boolean;
  demoFocusCounter?: number;
  onDiagnosticChange?: (diagnostico: DiagnosticoRecomendaciones) => void;
};

const RADIO_RECOMENDACION_METROS = 100;
const MAX_POPUPS_VISIBLES = 3;
const TACOS_EL_CHINO_ID = "tacos-el-chino";
const DEMO_ZOOM = 18;

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
  demoMode = false,
  demoFocusCounter = 0,
  onDiagnosticChange,
}: RecomendacionesMapaAnimadoProps) {
  const map = useMap();
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
  const mostrarTodosLosPopups = testMode || demoMode;
  const recomendacionesCercanas = mostrarTodosLosPopups
    ? recomendacionesConDistancia.slice(0, recomendacionesCircuitoNorte.length)
    : recomendacionesConDistancia
        .filter(
          (item) => item.distanciaMetros <= RADIO_RECOMENDACION_METROS
        )
        .slice(0, MAX_POPUPS_VISIBLES);
  const popupTacosDemo = recomendacionesConDistancia.find(
    (item) => item.recomendacion.id === TACOS_EL_CHINO_ID
  );
  const recomendacionesVisibles =
    recomendacionesCercanas.length > 0
      ? recomendacionesCercanas
      : popupTacosDemo
        ? [popupTacosDemo]
        : [];
  const tacosElChino = recomendacionesCircuitoNorte.find(
    (recomendacion) => recomendacion.id === TACOS_EL_CHINO_ID
  );

  useEffect(() => {
    onDiagnosticChange?.({
      total: recomendacionesCircuitoNorte.length,
      activas: active,
      distanciaMasCercanaMetros: Number.isFinite(distanciaMasCercanaMetros ?? NaN)
        ? distanciaMasCercanaMetros
        : null,
      popupsVisibles: recomendacionesVisibles.length,
    });
  }, [
    active,
    distanciaMasCercanaMetros,
    onDiagnosticChange,
    recomendacionesVisibles.length,
  ]);

  useEffect(() => {
    if (!active || !esCircuitoNorte || !demoMode || !tacosElChino) return;

    map.flyTo([tacosElChino.lat, tacosElChino.lng], DEMO_ZOOM, {
      duration: 1.1,
      easeLinearity: 0.22,
    });
  }, [active, demoFocusCounter, demoMode, esCircuitoNorte, map, tacosElChino]);

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

      {recomendacionesVisibles.map((item) => (
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
