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
    loadLeaflet().then((L) => {
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, { zoomControl: true }).setView([safeLat, safeLng], 17);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([safeLat, safeLng], { draggable: true }).addTo(map);
      const circle = L.circle([safeLat, safeLng], {
        radius: safeRadius,
        color: "#1E6FE0",
        weight: 2,
        fillColor: "#1E6FE0",
        fillOpacity: 0.18,
      }).addTo(map);

      const emit = (la: number, ln: number) => {
        marker.setLatLng([la, ln]);
        circle.setLatLng([la, ln]);
        onChangeRef.current({ lat: la, lng: ln });
      };

      marker.on("drag", (e: any) => {
        const p = e.target.getLatLng();
        circle.setLatLng(p);
      });
      marker.on("dragend", (e: any) => {
        const p = e.target.getLatLng();
        emit(p.lat, p.lng);
      });
      map.on("click", (e: any) => emit(e.latlng.lat, e.latlng.lng));

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      setTimeout(() => map.invalidateSize(), 200);
    });
    return () => {
      cancelled = true;
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
    <div
      ref={el}
      className="h-[280px] w-full overflow-hidden rounded-[14px] border border-line bg-[#E8F0E8]"
      role="application"
      aria-label="Attendance area map"
    />
  );
}
