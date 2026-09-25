"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

interface MapProps {
  originAddress: string;
  destinationAddress: string;
  encodedPolyline?: string;
}

export default function RouteMap({ originAddress, destinationAddress, encodedPolyline }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
      
      setOptions({
        key: apiKey,
      });

      try {
        const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;
        
        // Default center (Sri Lanka)
        const center = { lat: 7.8731, lng: 80.7718 };
        
        const map = new Map(mapRef.current, {
          center,
          zoom: 7,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        if (encodedPolyline) {
          const { encoding } = await importLibrary("geometry") as google.maps.GeometryLibrary;
          
          const path = encoding.decodePath(encodedPolyline);
          
          new google.maps.Polyline({
            path,
            strokeColor: "#2563EB", // Blue-600
            strokeWeight: 5,
            map
          });

          // Fit bounds to polyline
          const bounds = new google.maps.LatLngBounds();
          path.forEach((latLng) => bounds.extend(latLng));
          map.fitBounds(bounds);

          // Add simple markers for start and end
          const { Marker } = await importLibrary("marker") as google.maps.MarkerLibrary;
          
          if (path.length > 0) {
            new Marker({
              position: path[0],
              map,
              title: "Pickup",
            });
            
            new Marker({
              position: path[path.length - 1],
              map,
              title: "Drop Location",
            });
          }
        }

      } catch (error) {
        console.error("Map loading error:", error);
        setMapError(true);
      }
    };

    initMap();
  }, [originAddress, destinationAddress, encodedPolyline]);

  if (mapError) {
    return (
      <div className="w-full h-full bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-500 border border-slate-200 p-6 text-center">
        <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="font-medium">Interactive Map Unavailable</p>
        <p className="text-sm mt-1 max-w-xs">A valid Google Maps API key is required to render the live route map.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
      <div ref={mapRef} className="w-full h-full min-h-[300px]"></div>
    </div>
  );
}
