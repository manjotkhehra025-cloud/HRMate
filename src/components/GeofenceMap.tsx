"use client";

import { useEffect, useRef } from "react";

type LeafletNS = any;

let leafletLoader: Promise<LeafletNS> | null = null;

function loadLeaflet(): Promise<LeafletNS> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletLoader) return leafletLoader;
  leafletLoader = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.async = true;
    s.onload = () => resolve((window as any).L);
    s.onerror = () => reject(new Error("Failed to load OpenStreetMap"));
    document.body.appendChild(s);
  });
  return leafletLoader;
}

export default function GeofenceMap({
  lat,
  lng,
  radius,
  onChange,
}: {
  lat: number;
  lng: number;
  radius: number;
  onChange: (next: { lat: number; lng: number }) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const safeLat = Number.isFinite(lat) && Math.abs(lat) > 0.01 ? lat : 31.634;
  const safeLng = Number.isFinite(lng) && Math.abs(lng) > 0.01 ? lng : 74.8723;
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 100;

  useEffect(() => {
    let cancelled = false;
    let map: any = null;
    loadLeaflet().then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: false,
        tap: false,
        bounceAtZoomLimits: false,
        keyboard: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
      }).setView([safeLat, safeLng], 17);

      try {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        if (map.tap) map.tap.disable();
      } catch {
        /* older leaflet */
      }

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([safeLat, safeLng], { draggable: false }).addTo(map);
      const circle = L.circle([safeLat, safeLng], {
        radius: safeRadius,
        color: "#1E6FE0",
        weight: 2,
        fillColor: "#1E6FE0",
        fillOpacity: 0.18,
      }).addTo(map);

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      setTimeout(() => map.invalidateSize(), 200);
    });
    return () => {
      cancelled = true;
      if (map) {
        try {
          map.remove();
        } catch {
          /* ignore */
        }
      }
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;
    marker.setLatLng([safeLat, safeLng]);
    circle.setLatLng([safeLat, safeLng]);
    circle.setRadius(safeRadius);
    map.setView([safeLat, safeLng], map.getZoom() || 17);
  }, [safeLat, safeLng, safeRadius]);

  return (
    <div className="pointer-events-none relative z-0 h-[160px] w-full overflow-hidden rounded-[14px] border border-line bg-[#E8F0E8] sm:h-[240px]">
      <div ref={el} className="h-full w-full" role="img" aria-label="Attendance area map" />
    </div>
  );
}
