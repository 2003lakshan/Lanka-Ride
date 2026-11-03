import { useState, useEffect, useRef } from "react";
import { LocationState } from "./PlacesAutocompleteInput";
import { Map, Clock, AlertTriangle, Loader2 } from "lucide-react";

type TripDay = {
  dayNumber: number;
  date: string;
  startingLocation: LocationState | null;
  departureTime: string;
  placesToVisit: { location: LocationState; activityTime: string }[];
  overnightLocation: LocationState | null;
  notes: string;
};

interface ItineraryRouteSummaryProps {
  itinerary: TripDay[];
  onRouteCalculated?: (data: { totalDistanceKm: number; totalDurationMins: number; daySummaries: Record<number, DaySummary> }) => void;
}

interface RouteSegment {
  from: string;
  to: string;
  distanceKm: number;
  durationMins: number;
}

export interface DaySummary {
  dayNumber: number;
  segments: RouteSegment[];
  totalDrivingDistanceKm: number;
  totalDrivingTimeMins: number;
  totalActivityTimeMins: number;
  totalPlannedTimeMins: number;
  isValid: boolean;
  error?: string;
  isLoading: boolean;
}

// Convert activity time string to minutes
const parseActivityTime = (timeStr: string): number => {
  if (timeStr === "Pass by") return 0;
  if (timeStr === "1 hour") return 60;
  if (timeStr === "2 hours") return 120;
  if (timeStr === "3 hours") return 180;
  if (timeStr === "Half day") return 240;
  return 0; // Default
};

export const formatDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

/**
 * Route Provider: OSRM (Open Source Routing Machine) Demo Server
 * URL: http://router.project-osrm.org
 * Usage Limits: Max 1 request per second, max 10,000 requests per day.
 * API Key: None required for the demo server.
 * Production Requirements: For a production application, you MUST NOT use the demo server.
 * You should either set up your own OSRM instance (free, requires a server) or use a paid provider
 * like Mapbox, OpenRouteService, or GraphHopper which offer commercial SLAs.
 */
const osrmCache = new globalThis.Map<string, {distance: number, duration: number}[]>();

const fetchOsrmRoute = async (coordinates: {lat: number, lng: number}[]): Promise<{distance: number, duration: number}[]> => {
  if (coordinates.length < 2) return [];
  
  const coordsString = coordinates.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false&steps=false`;
  
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit exceeded (1 req/sec). Please wait.");
    throw new Error("Routing service error.");
  }
  
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error("No route found between some locations.");
  }

  const result = data.routes[0].legs.map((leg: any) => ({
    distance: leg.distance,
    duration: leg.duration
  }));
  
  osrmCache.set(coordsString, result);
  return result;
};

export default function ItineraryRouteSummary({ itinerary, onRouteCalculated }: ItineraryRouteSummaryProps) {
  const [daySummaries, setDaySummaries] = useState<Record<number, DaySummary>>({});
  
  useEffect(() => {
    let isCancelled = false;

    const computeRoutes = async () => {
      const newSummaries: Record<number, DaySummary> = {};
      
      for (const day of itinerary) {
        const locations: LocationState[] = [];
        
        if (day.startingLocation?.lat && day.startingLocation?.lng) {
          locations.push(day.startingLocation);
        }
        
        for (const place of day.placesToVisit) {
          if (place.location?.lat && place.location?.lng) {
            locations.push(place.location);
          }
        }
        
        if (day.overnightLocation?.lat && day.overnightLocation?.lng) {
          locations.push(day.overnightLocation);
        }

        if (locations.length < 2) {
          newSummaries[day.dayNumber] = {
            dayNumber: day.dayNumber,
            segments: [],
            totalDrivingDistanceKm: 0,
            totalDrivingTimeMins: 0,
            totalActivityTimeMins: 0,
            totalPlannedTimeMins: 0,
            isValid: false,
            error: "Add at least 2 locations to see route.",
            isLoading: false
          };
          setDaySummaries(prev => ({ ...prev, [day.dayNumber]: newSummaries[day.dayNumber] }));
          continue;
        }

        setDaySummaries(prev => ({
          ...prev,
          [day.dayNumber]: {
            ...(prev[day.dayNumber] || {}),
            dayNumber: day.dayNumber,
            isLoading: true,
            isValid: true,
            error: undefined
          } as DaySummary
        }));

        try {
          const coords = locations.map(l => ({ lat: l.lat, lng: l.lng }));
          const coordsString = coords.map(c => `${c.lng},${c.lat}`).join(';');
          
          let legs;
          if (osrmCache.has(coordsString)) {
            legs = osrmCache.get(coordsString)!;
          } else {
            await new Promise(r => setTimeout(r, 1100));
            if (isCancelled) return;
            legs = await fetchOsrmRoute(coords);
          }
          
          
          const segments: RouteSegment[] = [];
          let totalDrivingDistanceKm = 0;
          let totalDrivingTimeMins = 0;
          
          for (let i = 0; i < legs.length; i++) {
            const distKm = legs[i].distance / 1000;
            const durMins = legs[i].duration / 60;
            segments.push({
              from: locations[i].address || `Location ${i+1}`,
              to: locations[i+1].address || `Location ${i+2}`,
              distanceKm: distKm,
              durationMins: durMins
            });
            totalDrivingDistanceKm += distKm;
            totalDrivingTimeMins += durMins;
          }

          const totalActivityTimeMins = day.placesToVisit.reduce((total, place) => total + parseActivityTime(place.activityTime), 0);
          
          newSummaries[day.dayNumber] = {
            dayNumber: day.dayNumber,
            segments,
            totalDrivingDistanceKm,
            totalDrivingTimeMins,
            totalActivityTimeMins,
            totalPlannedTimeMins: totalDrivingTimeMins + totalActivityTimeMins,
            isValid: true,
            isLoading: false
          };

        } catch (error: any) {
          newSummaries[day.dayNumber] = {
            ...(daySummaries[day.dayNumber] || {}),
            dayNumber: day.dayNumber,
            isValid: false,
            isLoading: false,
            error: error.message || "Route unavailable"
          } as DaySummary;
        }
        
        setDaySummaries(prev => ({ ...prev, [day.dayNumber]: newSummaries[day.dayNumber] }));
      }
      
      if (!isCancelled && onRouteCalculated) {
        const totalDistanceKm = Object.values(newSummaries).reduce((acc, curr) => curr.isValid ? acc + curr.totalDrivingDistanceKm : acc, 0);
        const totalDurationMins = Object.values(newSummaries).reduce((acc, curr) => curr.isValid ? acc + curr.totalDrivingTimeMins : acc, 0);
        onRouteCalculated({ totalDistanceKm, totalDurationMins, daySummaries: newSummaries });
      }
    };

    computeRoutes();

    return () => {
      isCancelled = true;
    };
  }, [itinerary]);

  const validDaySummaries = Object.values(daySummaries).filter(summary => itinerary.some(day => day.dayNumber === summary.dayNumber));
  const totalTripDistance = validDaySummaries.reduce((acc, curr) => curr.isValid ? acc + curr.totalDrivingDistanceKm : acc, 0);
  const totalTripDrivingTime = validDaySummaries.reduce((acc, curr) => curr.isValid ? acc + curr.totalDrivingTimeMins : acc, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden sticky top-6">
      <div className="bg-slate-900 p-4 text-white">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Map size={20} className="text-blue-400" />
          Route Summary
        </h3>
        <p className="text-slate-400 text-xs mt-1">Estimated driving distances and times via OpenStreetMap.</p>
      </div>

      <div className="p-0 max-h-[calc(100vh-200px)] overflow-y-auto">
        {itinerary.map(day => {
          const summary = daySummaries[day.dayNumber];
          
          return (
            <div key={day.dayNumber} className="border-b border-slate-100 last:border-0 p-4">
              <h4 className="font-bold text-slate-800 mb-3 flex items-center justify-between">
                <span>Day {day.dayNumber}</span>
                {summary?.isLoading && <Loader2 size={16} className="animate-spin text-blue-500" />}
              </h4>
              
              {!summary ? (
                <div className="text-sm text-slate-500 italic">Waiting for route details...</div>
              ) : summary.isLoading && (!summary.segments || summary.segments.length === 0) ? (
                <div className="text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Calculating route...
                </div>
              ) : !summary.isValid ? (
                <div className="bg-amber-50 text-amber-700 p-3 rounded-xl text-xs flex gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <p>{summary.error}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Segments */}
                  <div className="space-y-2">
                    {summary.segments.map((seg, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="flex-1 truncate text-slate-600">
                          {seg.from.split(',')[0]} <span className="text-slate-400 mx-1">→</span> {seg.to.split(',')[0]}
                        </div>
                        <div className="shrink-0 font-medium text-slate-800 bg-slate-100 px-2 py-1 rounded ml-2">
                          {seg.distanceKm.toFixed(1)} km • {formatDuration(seg.durationMins)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Day Totals */}
                  <div className="bg-blue-50 p-3 rounded-xl space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-800">Driving Dist.</span>
                      <span className="font-bold text-blue-900">{summary.totalDrivingDistanceKm.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-800">Driving Time</span>
                      <span className="font-bold text-blue-900">{formatDuration(summary.totalDrivingTimeMins)}</span>
                    </div>
                    {summary.totalActivityTimeMins > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-800">Activity Time</span>
                        <span className="font-bold text-blue-900">{formatDuration(summary.totalActivityTimeMins)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-1.5 border-t border-blue-200/50 mt-1.5">
                      <span className="text-blue-900 font-bold flex items-center gap-1"><Clock size={14} /> Total Planned</span>
                      <span className="font-black text-blue-950">{formatDuration(summary.totalPlannedTimeMins)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="bg-slate-50 p-4 border-t border-slate-200">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Trip Totals</h4>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-2xl font-black text-slate-900">{totalTripDistance.toFixed(0)} km</div>
            <div className="text-sm font-medium text-slate-500">Total Distance</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900">{formatDuration(totalTripDrivingTime)}</div>
            <div className="text-sm font-medium text-slate-500">Est. Driving</div>
          </div>
        </div>
      </div>
    </div>
  );
}
