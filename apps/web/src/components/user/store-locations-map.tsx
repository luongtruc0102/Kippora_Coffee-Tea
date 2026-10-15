"use client";

import { latLngBounds, type LatLngTuple } from "leaflet";
import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";

import type { PublicStoreLocation } from "@/types/store-settings";

type MappedLocation = PublicStoreLocation & {
  latitude: number;
  longitude: number;
};

type Props = {
  locations: MappedLocation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

const DEFAULT_CENTER: LatLngTuple = [10.8569371, 106.7465042];

function MapViewport({
  locations,
  selectedId,
}: {
  locations: MappedLocation[];
  selectedId: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    const selected = locations.find((location) => location.id === selectedId);

    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], 16, {
        animate: true,
        duration: 0.7,
      });
      return;
    }

    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 15);
      return;
    }

    if (locations.length > 1) {
      map.fitBounds(
        latLngBounds(
          locations.map(
            (location) =>
              [location.latitude, location.longitude] as LatLngTuple,
          ),
        ),
        { maxZoom: 15, padding: [44, 44] },
      );
    }
  }, [locations, map, selectedId]);

  return null;
}

export default function StoreLocationsMap({
  locations,
  selectedId,
  onSelect,
}: Props) {
  const center = useMemo<LatLngTuple>(() => {
    const selected = locations.find((location) => location.id === selectedId);

    return selected
      ? [selected.latitude, selected.longitude]
      : locations[0]
        ? [locations[0].latitude, locations[0].longitude]
        : DEFAULT_CENTER;
  }, [locations, selectedId]);

  return (
    <div className="relative isolate z-0 h-[420px] w-full overflow-hidden rounded-3xl lg:h-[620px]">
      <MapContainer
        center={center}
        zoom={14}
        zoomControl={false}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((location) => {
          const selected = location.id === selectedId;

          return (
            <CircleMarker
              key={location.id}
              center={[location.latitude, location.longitude]}
              radius={selected ? 12 : 9}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => onSelect(location.id) }}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: selected ? "#4A2C20" : "#D98C3F",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                <strong>{location.name}</strong>
                <br />
                {location.isOpen ? "Đang mở cửa" : "Hiện chưa nhận đơn"}
              </Tooltip>
            </CircleMarker>
          );
        })}

        <MapViewport locations={locations} selectedId={selectedId} />
        <ZoomControl position="bottomright" />
      </MapContainer>

      <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-2xl bg-white/95 px-4 py-3 text-xs text-[#5E5650] shadow-lg backdrop-blur">
        Chọn một điểm trên bản đồ để xem chi nhánh
      </div>
    </div>
  );
}
