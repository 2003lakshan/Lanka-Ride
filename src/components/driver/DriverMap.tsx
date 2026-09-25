"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { Navigation } from "lucide-react";

interface DriverMapProps {
  bookingId: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  pickupName: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffName: string;
}

export default function DriverMap({ 
  bookingId,
  status, 
  pickupLat, 
  pickupLng, 
  pickupName, 
  dropoffLat, 
  dropoffLng,
  dropoffName
}: DriverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const mapInstanceRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const lastRouteFetchTime = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Target destination depends on whether we have picked up the passenger
  const isTripInProgress = status === "TRIP_IN_PROGRESS";
  const activeDestLat = isTripInProgress ? dropoffLat : pickupLat;
  const activeDestLng = isTripInProgress ? dropoffLng : pickupLng;
  const activeDestName = isTripInProgress ? dropoffName : pickupName;

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if ((window as any).locationSyncInterval) {
        clearInterval((window as any).locationSyncInterval);
      }
    };
  }, []);

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;
      setOptions({ key: apiKey });

      try {
        const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;
        const center = { lat: activeDestLat, lng: activeDestLng };
        
        const map = new Map(mapRef.current, {
          center,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        
        mapInstanceRef.current = map;

        const { Marker } = await importLibrary("marker") as google.maps.MarkerLibrary;
        destMarkerRef.current = new Marker({
          position: center,
          map,
          title: activeDestName,
          label: isTripInProgress ? "D" : "P"
        });

      } catch (error) {
        console.error("Map loading error:", error);
        setMapError(true);
      }
    };

    initMap();
  }, [activeDestLat, activeDestLng, activeDestName, isTripInProgress, apiKey]);

  const handleStartNavigation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setNavigating(true);
    setStatusText("Starting live tracking...");

    let latestPos: any = null;

    // 1. Keep track of the latest GPS coordinate
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestPos = position;

        // Immediately update driver marker on the local map
        const driverLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        
        importLibrary("marker").then((markerLib: any) => {
          if (!driverMarkerRef.current && mapInstanceRef.current) {
            driverMarkerRef.current = new markerLib.Marker({
              position: driverLocation,
              map: mapInstanceRef.current,
              title: "Your Location",
              icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
              zIndex: 999
            });
          } else if (driverMarkerRef.current) {
            driverMarkerRef.current.setPosition(driverLocation);
          }
        }).catch(() => {});

        // Fetch route (throttled locally)
        const now = Date.now();
        if (now - lastRouteFetchTime.current > 10000 && activeDestLat && activeDestLng && (activeDestLat !== 0 || activeDestLng !== 0)) {
          lastRouteFetchTime.current = now;
          importLibrary("geometry").then((geometryLib: any) => {
            const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
            fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
              },
              body: JSON.stringify({
                origin: { location: { latLng: { latitude: driverLocation.lat, longitude: driverLocation.lng } } },
                destination: { location: { latLng: { latitude: activeDestLat, longitude: activeDestLng } } },
                travelMode: 'DRIVE',
              }),
            }).then(r => r.json()).then(data => {
              if (data.routes?.[0]) {
                const route = data.routes[0];
                const encodedPolyline = route.polyline?.encodedPolyline;
                const distanceKm = Math.round((route.distanceMeters || 0) / 1000);
                const durationStr = route.duration || "0s";
                const durationMins = Math.round(parseInt(durationStr.replace("s", "")) / 60);

                const destStr = isTripInProgress ? "drop-off" : "pickup";
                setStatusText(`${distanceKm} km to ${destStr} (~${durationMins} min)`);

                if (mapInstanceRef.current && encodedPolyline) {
                  const path = geometryLib.encoding.decodePath(encodedPolyline);

                  if (routePolylineRef.current) {
                    routePolylineRef.current.setMap(null);
                  }

                  routePolylineRef.current = new google.maps.Polyline({
                    path,
                    strokeColor: isTripInProgress ? "#8B5CF6" : "#2563EB", 
                    strokeWeight: 5,
                    map: mapInstanceRef.current
                  });

                  const bounds = new google.maps.LatLngBounds();
                  path.forEach((latLng: any) => bounds.extend(latLng));
                  mapInstanceRef.current.fitBounds(bounds, 40);
                }
              }
            }).catch(e => console.error("Route fetch error:", e));
          });
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setStatusText(`Location error: ${error.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    // 2. Send location to server strictly every 5 seconds
    const interval = setInterval(async () => {
      if (!latestPos) return;

      const currentLat = latestPos.coords.latitude;
      const currentLng = latestPos.coords.longitude;
      const accuracy = latestPos.coords.accuracy;

      try {
        const res = await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, lat: currentLat, lng: currentLng, accuracy }),
        });
        
        if (res.ok) {
          setStatusText(`Location sent at ${new Date().toLocaleTimeString()}`);
        } else {
          const errData = await res.json();
          setStatusText(`Sync failed: ${errData.error || "Server error"}`);
        }
      } catch (e: any) {
        setStatusText(`Network error syncing location`);
      }
    }, 5000);

    // Store interval to clear on unmount
    (window as any).locationSyncInterval = interval;
  };

  if (mapError) {
    return (
      <div className="w-full h-full bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-500 border border-slate-200 p-6 text-center min-h-[300px]">
        <p className="font-medium">Interactive Map Unavailable</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div ref={mapRef} className="w-full h-64 sm:h-80 relative bg-slate-100"></div>
      
      <div className="p-6 flex justify-between items-center bg-slate-900 text-white">
        <div>
          <h3 className="font-bold text-lg">Navigate to {isTripInProgress ? "Drop-off" : "Pickup"}</h3>
          <p className="text-slate-400 text-sm">
            {navigating ? statusText : "View route from your location"}
          </p>
        </div>
        {!navigating && (
          <button 
            onClick={handleStartNavigation}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg"
          >
            <Navigation size={18} />
            Show Route
          </button>
        )}
      </div>
    </div>
  );
}
