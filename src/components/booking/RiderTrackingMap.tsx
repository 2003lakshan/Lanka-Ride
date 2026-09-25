"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { Clock } from "lucide-react";

interface RiderTrackingMapProps {
  status: string;
  driverLat?: number;
  driverLng?: number;
  driverLocationUpdatedAt?: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}

export default function RiderTrackingMap({
  status,
  driverLat,
  driverLng,
  driverLocationUpdatedAt,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
}: RiderTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);
  const [etaText, setEtaText] = useState("");
  const [lastUpdateText, setLastUpdateText] = useState("");
  const [isStale, setIsStale] = useState(false);
  
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const hasFitBoundsRef = useRef<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // The active destination depends on the trip status
  const isTripInProgress = status === "TRIP_IN_PROGRESS" || status === "COMPLETED";
  const activeDestLat = isTripInProgress ? dropoffLat : pickupLat;
  const activeDestLng = isTripInProgress ? dropoffLng : pickupLng;

  // Check if location is stale
  useEffect(() => {
    if (!driverLocationUpdatedAt) return;
    
    const updateTime = () => {
      const updatedDate = new Date(driverLocationUpdatedAt);
      const diffMs = Date.now() - updatedDate.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      
      if (diffSecs > 15) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
      
      setLastUpdateText(`Last updated ${updatedDate.toLocaleTimeString()}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [driverLocationUpdatedAt]);

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;
      setOptions({ key: apiKey });
      try {
        const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;
        const { Marker } = await importLibrary("marker") as google.maps.MarkerLibrary;

        const bounds = new google.maps.LatLngBounds();

        const map = new Map(mapRef.current, {
          center: { lat: pickupLat, lng: pickupLng },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        
        mapInstanceRef.current = map;

        pickupMarkerRef.current = new Marker({
          position: { lat: pickupLat, lng: pickupLng },
          map,
          title: "Pickup",
          label: "P"
        });
        bounds.extend({ lat: pickupLat, lng: pickupLng });

        if (dropoffLat && dropoffLng && (dropoffLat !== 0 || dropoffLng !== 0)) {
          destMarkerRef.current = new Marker({
            position: { lat: dropoffLat, lng: dropoffLng },
            map,
            title: "Destination",
            label: "D"
          });
          bounds.extend({ lat: dropoffLat, lng: dropoffLng });
        }

        if (driverLat && driverLng) {
          bounds.extend({ lat: driverLat, lng: driverLng });
        }

        map.fitBounds(bounds, 40);
        setMapLoaded(true);

      } catch (error) {
        console.error("Map loading error:", error);
        setMapError(true);
      }
    };

    if (!mapInstanceRef.current) {
      initMap();
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, apiKey]);

  // Update driver marker and calculate route when driverLat/driverLng changes
  useEffect(() => {
    console.log("RiderTrackingMap: driverLat/driverLng effect triggered", { driverLat, driverLng, mapExists: !!mapInstanceRef.current });
    if (!mapInstanceRef.current || !driverLat || !driverLng) return;

    const updateDriverAndRoute = async () => {
      try {
        console.log("RiderTrackingMap: importing marker library");
        const { Marker } = await importLibrary("marker") as google.maps.MarkerLibrary;
        const driverPos = { lat: Number(driverLat), lng: Number(driverLng) };
        console.log("RiderTrackingMap: driverPos set to", driverPos);

        // 1. Update Driver Marker
        if (!driverMarkerRef.current) {
          console.log("RiderTrackingMap: creating new driver marker");
          driverMarkerRef.current = new Marker({
            position: driverPos,
            map: mapInstanceRef.current,
            title: "Driver Location",
            icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
            zIndex: 999
          });
        } else {
          console.log("RiderTrackingMap: updating existing driver marker");
          driverMarkerRef.current.setPosition(driverPos);
        }
      } catch (err) {
        console.error("RiderTrackingMap: Error updating driver marker:", err);
      }

      // 2. Fetch Route from Driver to active destination
      if (activeDestLat && activeDestLng && (activeDestLat !== 0 || activeDestLng !== 0)) {
        try {
          const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
            },
            body: JSON.stringify({
              origin: { location: { latLng: { latitude: Number(driverLat), longitude: Number(driverLng) } } },
              destination: { location: { latLng: { latitude: Number(activeDestLat), longitude: Number(activeDestLng) } } },
              travelMode: 'DRIVE',
            }),
          });

          const data = await response.json();
          
          if (response.ok && data.routes?.[0]) {
            const route = data.routes[0];
            const encodedPolyline = route.polyline?.encodedPolyline;
            
            if (route.duration) {
              const durationMins = Math.round(parseInt(route.duration.replace("s", "")) / 60);
              setEtaText(`Driver is approx ${durationMins} min away`);
            }

            if (encodedPolyline) {
              const { encoding } = await importLibrary("geometry") as google.maps.GeometryLibrary;
              const path = encoding.decodePath(encodedPolyline);

              if (routePolylineRef.current) {
                routePolylineRef.current.setMap(null);
              }

              routePolylineRef.current = new google.maps.Polyline({
                path,
                strokeColor: isTripInProgress ? "#8B5CF6" : "#2563EB", 
                strokeWeight: 5,
                map: mapInstanceRef.current
              });

              // Adjust bounds only on first successful route load
              if (!hasFitBoundsRef.current) {
                const bounds = new google.maps.LatLngBounds();
                bounds.extend({ lat: pickupLat, lng: pickupLng });
                if (dropoffLat && dropoffLng && (dropoffLat !== 0 || dropoffLng !== 0)) {
                  bounds.extend({ lat: dropoffLat, lng: dropoffLng });
                }
                path.forEach((latLng: any) => bounds.extend(latLng));
                mapInstanceRef.current.fitBounds(bounds, 40);
                hasFitBoundsRef.current = true;
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch tracking route:", error);
        }
      }
    };

    updateDriverAndRoute();
  }, [driverLat, driverLng, activeDestLat, activeDestLng, isTripInProgress, pickupLat, pickupLng, dropoffLat, dropoffLng, apiKey, mapLoaded]);

  if (mapError) {
    return (
      <div className="w-full h-full bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-500 border border-slate-200 p-6 text-center">
        <p className="font-medium">Interactive Map Unavailable</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      {!driverLat ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm text-center border border-slate-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 9l-6 6"></path><path d="M4 9l6 6"></path><path d="M14 9l6 6"></path><path d="M20 9l-6 6"></path></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Waiting for driver location</h3>
            <p className="text-slate-500 text-sm">The driver has not yet started sharing their live location for this trip.</p>
          </div>
        </div>
      ) : isStale ? (
        <div className="absolute top-6 left-6 z-20 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg border border-amber-200 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
            <Clock size={16} />
          </div>
          <div>
            <span className="block text-xs font-bold text-amber-600 uppercase tracking-widest">Signal Lost</span>
            <span className="text-sm font-bold text-slate-700">{lastUpdateText}</span>
          </div>
        </div>
      ) : (
        <div className="absolute top-6 left-6 z-20 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg border border-emerald-100 flex items-center gap-3 transition-all">
          <span className="relative flex h-4 w-4 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
          </span>
          <div>
            <span className="block text-xs font-bold text-emerald-600 uppercase tracking-widest">Live GPS Tracker</span>
            <span className="text-sm font-bold text-slate-700">{lastUpdateText}</span>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full min-h-[350px]"></div>
      
      {etaText && driverLat && !isStale && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-8 py-4 rounded-2xl font-bold shadow-2xl border border-white/20 whitespace-nowrap z-10 flex flex-col items-center">
          <span className="text-xs text-slate-400 uppercase tracking-widest mb-1">Estimated Arrival</span>
          <span className="text-xl tracking-tight">{etaText.replace('Driver is approx ', '').replace(' away', '')} Away</span>
        </div>
      )}
    </div>
  );
}
