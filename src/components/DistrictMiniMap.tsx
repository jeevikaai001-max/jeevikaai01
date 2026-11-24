import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from './Icons';
import { Opportunity, LocationAccuracyLevel } from '../types';

interface DistrictMiniMapProps {
  latitude?: number;
  longitude?: number;
  district?: string;
  state?: string;
  locality?: string;
  accuracyLevel?: LocationAccuracyLevel;
  accuracyMeters?: number;
  confidenceScore?: number;
  trainingCenters?: Opportunity[];
  opportunities?: Opportunity[];
  onReDetect?: () => void;
  isDetecting?: boolean;
}

export const DistrictMiniMap: React.FC<DistrictMiniMapProps> = ({
  latitude = 28.6692,
  longitude = 77.4538,
  district = 'ग़ाज़ियाबाद',
  state = 'Uttar Pradesh',
  locality,
  accuracyLevel = 'District-level',
  accuracyMeters,
  confidenceScore = 88,
  trainingCenters = [],
  onReDetect,
  isDetecting = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const lat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : 28.6692;
  const lng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : 77.4538;

  const radiusMeters =
    accuracyLevel === 'Precise'
      ? Math.max(120, Math.min(accuracyMeters || 200, 1500))
      : accuracyLevel === 'District-level'
      ? 5000
      : 15000;

  const zoomLevel = accuracyLevel === 'Precise' ? 14 : accuracyLevel === 'District-level' ? 12 : 9;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: zoomLevel,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        minZoom: 6,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;

      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 200);

      return () => {
        clearTimeout(timer);
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (err) {
      console.warn('Map initialization failed:', err);
    }
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const circle = L.circle([lat, lng], {
      radius: radiusMeters,
      color: '#287D73',
      weight: 2,
      opacity: 0.8,
      fillColor: '#287D73',
      fillOpacity: 0.14,
      dashArray: accuracyLevel === 'Precise' ? undefined : '5, 5',
    });
    circle.addTo(layer);

    const userIconHtml = `
      <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 24px; height: 24px; border-radius: 9999px; background: #287D73; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28); border: 2.5px solid #ffffff; font-size: 12px;">
          📍
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userIconHtml,
      className: 'user-location-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
    });

    const userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(layer);
    userMarker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #17365D; padding: 2px;">
        <div style="font-weight: 800; color: #287D73; margin-bottom: 2px;">📍 आपकी अनुमानित स्थिति (Your Location)</div>
        <div style="font-size: 13px; font-weight: 700;">${locality ? `${locality}, ` : ''}${district}</div>
        <div style="color: #5F6B76; font-size: 11px; margin-top: 3px;">${state} · ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</div>
        <div style="display: inline-block; margin-top: 5px; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; background: #E6F4F1; color: #1E6058;">
          ${accuracyLevel === 'Precise' ? `सटीक GPS (±${accuracyMeters || 100}m)` : `जिला स्तर दायरा (${confidenceScore}% विश्वास)`}
        </div>
      </div>
    `);

    const centersToPlot = trainingCenters.slice(0, 4);
    centersToPlot.forEach((center, idx) => {
      const angle = (idx * (2 * Math.PI)) / Math.max(centersToPlot.length, 1);
      const distOffset = 0.018 + idx * 0.009;
      const centerLat = lat + Math.sin(angle) * distOffset;
      const centerLng = lng + Math.cos(angle) * distOffset;

      const centerIconHtml = `
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 22px; height: 22px; border-radius: 7px; background: #17365D; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.22); border: 2px solid #ffffff; font-size: 11px;">
            🏛️
          </div>
        </div>
      `;

      const centerIcon = L.divIcon({
        html: centerIconHtml,
        className: 'center-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([centerLat, centerLng], { icon: centerIcon }).addTo(layer);
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 11px; color: #17365D; max-width: 200px;">
          <div style="font-weight: 800; color: #245A91;">🏛️ ${center.org || 'सरकारी कौशल केंद्र'}</div>
          <div style="font-weight: 700; margin-top: 2px;">${center.title}</div>
          <div style="color: #5F6B76; font-size: 10px; margin-top: 2px;">📍 ${center.loc} (लगभग ${center.km} km)</div>
          <div style="color: #287D73; font-weight: 700; font-size: 10px; margin-top: 3px;">${center.pay}</div>
        </div>
      `);
    });

    map.setView([lat, lng], zoomLevel, { animate: true });
  }, [lat, lng, district, state, locality, accuracyLevel, accuracyMeters, confidenceScore, trainingCenters, zoomLevel, radiusMeters]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], zoomLevel, { animate: true });
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#DCE3EA] overflow-hidden flex flex-col">
      {/* Map Control Header */}
      <div className="px-4 py-2.5 bg-[#F7F9FC] border-b border-[#DCE3EA] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[#287D73] text-white">
            <Icon name="map" size={13} />
          </span>
          <div>
            <span className="font-extrabold text-[#17365D]">
              स्थानीय मानचित्र · District Map
            </span>
            <span className="text-[11px] text-[#5F6B76] ml-1.5 hidden sm:inline">
              ({locality ? `${locality}, ` : ''}{district})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold tabular-nums bg-white border border-[#DCE3EA] text-[#17365D]">
            <Icon name="pin" size={11} className="text-[#287D73]" />
            <span>{lat.toFixed(4)}° N, {lng.toFixed(4)}° E</span>
          </span>

          {accuracyLevel === 'Precise' ? (
            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#287D73]/10 text-[#1E6058] border border-[#287D73]/25">
              Precise GPS
            </span>
          ) : (
            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#245A91]/10 text-[#17365D] border border-[#245A91]/25">
              District Centroid
            </span>
          )}

          {onReDetect && (
            <button
              type="button"
              onClick={onReDetect}
              disabled={isDetecting}
              className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-[#DCE3EA] text-[#287D73] flex items-center justify-center transition-colors"
              title="GPS पुनः पहचानें (Re-detect GPS)"
              aria-label="Re-detect GPS"
            >
              <Icon name={isDetecting ? 'refresh' : 'target'} size={13} className={isDetecting ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-[#DCE3EA] text-[#17365D] flex items-center justify-center transition-colors"
            title={isExpanded ? 'छोटा करें (Collapse)' : 'बड़ा करें (Expand)'}
            aria-label={isExpanded ? 'Collapse map' : 'Expand map'}
          >
            <Icon name={isExpanded ? 'minimize' : 'maximize'} size={13} />
          </button>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="relative w-full">
        <div
          ref={mapContainerRef}
          className={`w-full transition-all duration-300 z-10 ${
            isExpanded ? 'h-[360px]' : 'h-[210px] sm:h-[230px]'
          }`}
          style={{ minHeight: isExpanded ? '360px' : '210px' }}
        />

        {/* Floating In-Map Navigation Controls */}
        <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleRecenter}
            className="w-8 h-8 rounded-lg bg-white hover:bg-[#F7F9FC] border border-[#DCE3EA] text-[#287D73] flex items-center justify-center font-bold text-xs transition-colors"
            title="मेरी स्थिति पर केंद्रित करें (Center to My Location)"
            aria-label="Recenter map"
          >
            <Icon name="crosshair" size={14} />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-white hover:bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D] flex items-center justify-center font-bold text-sm transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-white hover:bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D] flex items-center justify-center font-bold text-sm transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            −
          </button>
        </div>

        {/* Approximate Radius Badge */}
        <div className="absolute bottom-2 left-2 z-20 px-2.5 py-1 rounded-lg bg-white/95 border border-[#DCE3EA] text-[10px] font-bold text-[#17365D] flex items-center gap-1.5 tabular-nums">
          <span className="w-2 h-2 rounded-full bg-[#287D73]" />
          <span>
            {accuracyLevel === 'Precise'
              ? `अनुमानित क्षेत्र: ±${accuracyMeters || 150}m दायरा`
              : `अनुमानित क्षेत्र: ${district} जिला दायरा (~5 km)`}
          </span>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="px-4 py-2 bg-[#F7F9FC] border-t border-[#DCE3EA] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5F6B76]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#287D73]" />
            <span className="font-semibold text-[#17365D]">आपकी स्थिति (You)</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#17365D]" />
            <span className="font-semibold text-[#17365D]">कौशल केंद्र (Institutes)</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-1 rounded-full border border-dashed border-[#287D73] bg-[#287D73]/20" />
            <span>कवरेज दायरा</span>
          </span>
        </div>

        <div className="text-[10px] text-[#287D73] font-bold tabular-nums">
          {trainingCenters.length > 0 ? `${trainingCenters.length} नजदीकी केंद्र मैप पर दर्शाए गए हैं` : 'स्थानीय अवसर सक्रिय हैं'}
        </div>
      </div>
    </div>
  );
};
