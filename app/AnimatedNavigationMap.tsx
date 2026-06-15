"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

type Position = [number, number];

type AnimatedNavigationMapProps = {
  active: boolean;
  onLocationChange?: (position: Position) => void;
};

const NAVIGATION_ZOOM = 18;
const MIN_CAMERA_MOVE_METERS = 4;

const userNavigationIcon = new L.DivIcon({
  html: `
    <div class="rt-animated-nav-user" aria-hidden="true">
      <span class="rt-animated-nav-user__ring"></span>
      <span class="rt-animated-nav-user__car">🚐</span>
    </div>
  `,
  className: "",
  iconSize: [64, 64],
  iconAnchor: [32, 34],
});

const buildingIcon = new L.DivIcon({
  html: `<div class="rt-animated-nav-building" aria-hidden="true"></div>`,
  className: "",
  iconSize: [48, 58],
  iconAnchor: [24, 48],
});

const treeIcon = new L.DivIcon({
  html: `<div class="rt-animated-nav-tree" aria-hidden="true"></div>`,
  className: "",
  iconSize: [42, 54],
  iconAnchor: [21, 48],
});

const coinIcon = new L.DivIcon({
  html: `<div class="rt-animated-nav-coin" aria-hidden="true">$</div>`,
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function distanciaAproximadaMetros(a: Position, b: Position) {
  const metrosPorGradoLat = 111_320;
  const latPromedio = ((a[0] + b[0]) / 2) * (Math.PI / 180);
  const metrosPorGradoLng = metrosPorGradoLat * Math.cos(latPromedio);
  const dLat = (a[0] - b[0]) * metrosPorGradoLat;
  const dLng = (a[1] - b[1]) * metrosPorGradoLng;

  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function offsetPosition(
  position: Position,
  latOffset: number,
  lngOffset: number
): Position {
  return [position[0] + latOffset, position[1] + lngOffset];
}

export default function AnimatedNavigationMap({
  active,
  onLocationChange,
}: AnimatedNavigationMapProps) {
  const map = useMap();
  const lastCameraPositionRef = useRef<Position | null>(null);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!active || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextPosition: Position = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        const lastCameraPosition = lastCameraPositionRef.current;
        const shouldMoveCamera =
          !lastCameraPosition ||
          distanciaAproximadaMetros(lastCameraPosition, nextPosition) >=
            MIN_CAMERA_MOVE_METERS;

        setCurrentPosition(nextPosition);
        onLocationChange?.(nextPosition);

        if (shouldMoveCamera) {
          lastCameraPositionRef.current = nextPosition;
          map.flyTo(nextPosition, NAVIGATION_ZOOM, {
            duration: 1.2,
            easeLinearity: 0.22,
          });
        }
      },
      () => {
        // Si el usuario no concede GPS, el mapa normal sigue funcionando igual.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [active, map, onLocationChange]);

  const decorativeElements = useMemo(() => {
    if (!currentPosition) return null;

    const streetOne: Position[] = [
      offsetPosition(currentPosition, -0.00042, -0.0005),
      offsetPosition(currentPosition, -0.00018, -0.0002),
      offsetPosition(currentPosition, 0.00008, 0.00016),
      offsetPosition(currentPosition, 0.00034, 0.00046),
    ];
    const streetTwo: Position[] = [
      offsetPosition(currentPosition, -0.00036, 0.00034),
      offsetPosition(currentPosition, -0.00006, 0.00012),
      offsetPosition(currentPosition, 0.00024, -0.00015),
      offsetPosition(currentPosition, 0.00046, -0.00038),
    ];

    return {
      streets: [streetOne, streetTwo],
      buildings: [
        offsetPosition(currentPosition, 0.00026, 0.0003),
        offsetPosition(currentPosition, -0.00024, -0.00034),
        offsetPosition(currentPosition, 0.00046, -0.0002),
      ],
      trees: [
        offsetPosition(currentPosition, 0.00016, -0.00042),
        offsetPosition(currentPosition, -0.00042, 0.00022),
      ],
      coins: [
        offsetPosition(currentPosition, 0.00002, 0.00038),
        offsetPosition(currentPosition, -0.0002, 0.00008),
      ],
    };
  }, [currentPosition]);

  if (!active || !currentPosition || !decorativeElements) return null;

  return (
    <>
      {decorativeElements.streets.map((street, index) => (
        <Polyline
          key={`animated-street-${index}`}
          positions={street}
          pathOptions={{
            color: index === 0 ? "#facc15" : "#38bdf8",
            weight: 8,
            opacity: 0.88,
            lineCap: "round",
            lineJoin: "round",
            dashArray: "14 12",
            className: "rt-animated-nav-street",
          }}
        />
      ))}

      {decorativeElements.buildings.map((position, index) => (
        <Marker
          key={`animated-building-${index}`}
          position={position}
          icon={buildingIcon}
          interactive={false}
        />
      ))}

      {decorativeElements.trees.map((position, index) => (
        <Marker
          key={`animated-tree-${index}`}
          position={position}
          icon={treeIcon}
          interactive={false}
        />
      ))}

      {decorativeElements.coins.map((position, index) => (
        <Marker
          key={`animated-coin-${index}`}
          position={position}
          icon={coinIcon}
          interactive={false}
        />
      ))}

      <Marker
        position={currentPosition}
        icon={userNavigationIcon}
        interactive={false}
        zIndexOffset={1200}
      />
    </>
  );
}
