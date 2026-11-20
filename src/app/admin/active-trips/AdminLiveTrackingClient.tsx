"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Navigation, 
  Car, 
  User, 
  MapPin, 
  Clock, 
  ExternalLink, 
  Search, 
  Filter, 
  AlertTriangle,
  Radio,
  Layers,
  Phone,
  CheckCircle2,
  List,
  Map as MapIcon,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import RiderTrackingMap from "@/components/booking/RiderTrackingMap";
import { useSocket } from "@/components/providers/SocketProvider";

export default function AdminLiveTrackingClient({ initialActiveBookings }: { initialActiveBookings: any[] }) {
  const { socket, isConnected } = useSocket();
  const [activeBookings, setActiveBookings] = useState<any[]>(initialActiveBookings);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    initialActiveBookings.length > 0 ? initialActiveBookings[0]._id : null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [followDriver, setFollowDriver] = useState(true);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [mobileCardExpanded, setMobileCardExpanded] = useState(true);

  // Realtime listeners for all active driver locations
  useEffect(() => {
    if (!socket) return;

    const handleLocationUpdate = (data: { bookingId: string, lat: number, lng: number, accuracy: number, updatedAt: string }) => {
      setActiveBookings(prev => prev.map(booking => {
        if (booking._id === data.bookingId) {
          return {
            ...booking,
            driverLocation: {
              lat: data.lat,
              lng: data.lng,
              accuracy: data.accuracy,
              updatedAt: data.updatedAt
            }
          };
        }
        return booking;
      }));
    };

    const handleStatusChanged = (data: { bookingId: string, status: string }) => {
      const activeStatuses = [
        "DRIVER_ASSIGNED", 
        "DRIVER_EN_ROUTE", 
        "DRIVER_ARRIVED", 
        "PASSENGER_PICKED_UP", 
        "TRIP_IN_PROGRESS"
      ];
      
      if (!activeStatuses.includes(data.status)) {
        setActiveBookings(prev => prev.filter(b => b._id !== data.bookingId));
        if (selectedTripId === data.bookingId) {
          setSelectedTripId(null);
        }
      } else {
        setActiveBookings(prev => prev.map(b => b._id === data.bookingId ? { ...b, status: data.status } : b));
      }
    };

    socket.on("driver:location_updated", handleLocationUpdate);
    socket.on("booking:status_changed", handleStatusChanged);

    return () => {
      socket.off("driver:location_updated", handleLocationUpdate);
      socket.off("booking:status_changed", handleStatusChanged);
    };
  }, [socket, selectedTripId]);

  // Periodic polling fallback during socket disconnection
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isConnected) {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/admin/bookings/active");
          if (res.ok) {
            const data = await res.json();
            setActiveBookings(data.data || []);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  // Selected trip single polling fallback
  useEffect(() => {
    let selectedInterval: NodeJS.Timeout;
    if (!isConnected && selectedTripId) {
      selectedInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/bookings/${selectedTripId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              setActiveBookings(prev => prev.map(b => b._id === selectedTripId ? data.data : b));
            }
          }
        } catch (e) {
          console.error("Single trip poll error", e);
        }
      }, 5000);
    }
    return () => {
      if (selectedInterval) clearInterval(selectedInterval);
    };
  }, [selectedTripId, isConnected]);

  const filteredBookings = activeBookings.filter(b => {
    const riderName = (b.rider?.fullName || b.passengerDetails?.fullName || "").toLowerCase();
    const driverName = (b.driverId?.name || "").toLowerCase();
    const ref = (b.bookingReference || "").toLowerCase();
    const query = searchTerm.toLowerCase();
    return ref.includes(query) || driverName.includes(query) || riderName.includes(query);
  });

  const selectedTrip = activeBookings.find(b => b._id === selectedTripId);
  const isCustomTrip = selectedTrip?.customTripDetails?.isCustomTrip;
  
  const itineraryLocations = isCustomTrip 
    ? (selectedTrip.customTripDetails?.itinerary || []).flatMap((day: any) => (day.placesToVisit || []).map((place: any) => ({
        lat: place.location?.lat || place.lat || 0,
        lng: place.location?.lng || place.lng || 0,
        name: place.name || "Attraction"
      })))
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRIVER_EN_ROUTE": return "bg-amber-100 text-amber-800 border-amber-300";
      case "DRIVER_ARRIVED": return "bg-blue-100 text-blue-800 border-blue-300";
      case "PASSENGER_PICKED_UP":
      case "TRIP_IN_PROGRESS": return "bg-emerald-100 text-emerald-800 border-emerald-300";
      default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  const getLocationStatus = (updatedAt?: string) => {
    if (!updatedAt) {
      return { 
        tier: "OFFLINE", 
        label: "No GPS Signal", 
        color: "text-rose-700 bg-rose-50 border-rose-200", 
        dot: "bg-rose-500" 
      };
    }
    const diffSecs = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000);
    if (diffSecs < 120) {
      return { 
        tier: "LIVE", 
        label: `${diffSecs}s ago`, 
        color: "text-emerald-700 bg-emerald-50 border-emerald-200", 
        dot: "bg-emerald-500 animate-pulse" 
      };
    } else if (diffSecs < 600) {
      const mins = Math.floor(diffSecs / 60);
      return { 
        tier: "STALE", 
        label: `${mins}m ago`, 
        color: "text-amber-700 bg-amber-50 border-amber-200", 
        dot: "bg-amber-500" 
      };
    } else {
      const mins = Math.floor(diffSecs / 60);
      return { 
        tier: "OFFLINE", 
        label: `${mins}m ago`, 
        color: "text-rose-700 bg-rose-50 border-rose-200", 
        dot: "bg-rose-500" 
      };
    }
  };

  const selectedRiderName = selectedTrip?.rider?.fullName || selectedTrip?.passengerDetails?.fullName || "Rider name unavailable";
  const selectedRiderPhone = selectedTrip?.rider?.whatsappNumber || (selectedTrip?.passengerDetails?.whatsappNumber !== "No contact provided" ? selectedTrip?.passengerDetails?.whatsappNumber : null) || "No contact provided";

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] md:h-[calc(100dvh-8rem)] rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs bg-white">
      
      {/* Top Bar Stats & Mobile Switcher */}
      <div className="bg-[#102A43] text-white px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-base sm:text-lg font-extrabold flex items-center gap-2 text-white">
            <Radio className="text-emerald-400 animate-pulse" size={18} /> Active Fleet Operations
          </h1>
          <span className="bg-blue-600/50 text-blue-200 font-bold px-2.5 py-0.5 rounded-full text-xs border border-blue-400/30">
            {activeBookings.length} Active
          </span>
        </div>

        {/* Mobile View Toggle Buttons (< md) */}
        <div className="flex md:hidden items-center p-1 bg-slate-900/60 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setMobileView("map")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              mobileView === "map" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400"
            }`}
          >
            <MapIcon size={13} />
            <span>Map</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              mobileView === "list" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400"
            }`}
          >
            <List size={13} />
            <span>List ({activeBookings.length})</span>
          </button>
        </div>

        {/* Desktop Controls */}
        <div className="hidden md:flex items-center gap-2">
          {!isConnected && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-600/40">
              <AlertTriangle size={14} /> Reconnecting (HTTP Polling)
            </span>
          )}
          <Link 
            href="/admin/trips" 
            className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
          >
            All Bookings
          </Link>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Sidebar: Trips List (Visible on md+, or when mobileView === 'list' on mobile) */}
        <div className={`
          border-r border-slate-200 bg-white flex flex-col shrink-0 z-10
          ${mobileView === "list" ? "flex w-full" : "hidden md:flex md:w-80 lg:w-96"}
        `}>
          
          {/* Search Header */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/60">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search reference, driver, rider..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* List Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-medium">
                No active trips currently in transit
              </div>
            ) : filteredBookings.map(booking => {
              const statusInfo = getLocationStatus(booking.driverLocation?.updatedAt);
              const selected = selectedTripId === booking._id;
              const rName = booking.rider?.fullName || booking.passengerDetails?.fullName || "Rider name unavailable";
              
              return (
                <div 
                  key={booking._id} 
                  onClick={() => {
                    setSelectedTripId(booking._id);
                    if (window.innerWidth < 768) {
                      setMobileView("map");
                    }
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selected 
                      ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500/20' 
                      : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-bold text-[#102A43]">{booking.bookingReference}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${getStatusColor(booking.status)}`}>
                      {booking.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-800 line-clamp-1">{booking.driverId?.name || "Unknown Driver"}</div>
                  <div className="text-xs text-slate-500 line-clamp-1 mb-2">{rName}</div>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                      <span className={`text-[11px] font-bold ${
                        statusInfo.tier === "LIVE" ? "text-emerald-700" :
                        statusInfo.tier === "STALE" ? "text-amber-700" : "text-rose-700"
                      }`}>
                        {statusInfo.tier}: {statusInfo.label}
                      </span>
                    </div>

                    <span className="text-[10px] text-blue-600 font-bold hover:underline">
                      Track &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content: Map & Overlays (Visible on md+, or when mobileView === 'map' on mobile) */}
        <div className={`
          flex-1 flex flex-col relative bg-slate-100
          ${mobileView === "map" ? "flex w-full" : "hidden md:flex"}
        `}>
          {selectedTrip ? (
            <>
              {/* Map View */}
              <div className="flex-1 relative w-full h-full">
                <RiderTrackingMap 
                  status={selectedTrip.status}
                  driverLat={selectedTrip.driverLocation?.lat}
                  driverLng={selectedTrip.driverLocation?.lng}
                  driverLocationUpdatedAt={selectedTrip.driverLocation?.updatedAt}
                  pickupLat={selectedTrip.pickupLat || selectedTrip.pickupCoordinates?.lat || (selectedTrip.airportId?.location ? selectedTrip.airportId.location.lat : 0)}
                  pickupLng={selectedTrip.pickupLng || selectedTrip.pickupCoordinates?.lng || (selectedTrip.airportId?.location ? selectedTrip.airportId.location.lng : 0)}
                  dropoffLat={selectedTrip.destinationLat || selectedTrip.destinationCoordinates?.lat || 0}
                  dropoffLng={selectedTrip.destinationLng || selectedTrip.destinationCoordinates?.lng || 0}
                  itineraryLocations={itineraryLocations}
                  followDriver={followDriver}
                />

                {/* Desktop Floating Overlay Card (Top Left) */}
                <div className="hidden md:block absolute top-4 left-4 z-20 pointer-events-auto">
                  <div className="bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/80 rounded-2xl p-4 w-80 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <span className="font-mono font-bold text-slate-900 text-sm block">{selectedTrip.bookingReference}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${getStatusColor(selectedTrip.status)}`}>
                          {selectedTrip.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <Link 
                        href={`/admin/trips/${selectedTrip._id}`} 
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-lg transition-colors" 
                        title="View Full Trip"
                      >
                        <ExternalLink size={16} />
                      </Link>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600 shrink-0 mt-0.5">
                          <Car size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Driver</p>
                          <p className="font-bold text-slate-900 truncate">{selectedTrip.driverId?.name || "Assigned Driver"}</p>
                          <p className="text-slate-500 text-[11px]">{selectedTrip.driverId?.phoneNumber || "No phone"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600 shrink-0 mt-0.5">
                          <User size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Rider</p>
                          <p className="font-bold text-slate-900 truncate">{selectedRiderName}</p>
                          <p className="text-slate-500 text-[11px]">{selectedRiderPhone}</p>
                        </div>
                      </div>
                    </div>

                    {/* GPS Signal Status */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      {(() => {
                        const statusInfo = getLocationStatus(selectedTrip.driverLocation?.updatedAt);
                        return (
                          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${statusInfo.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                            {statusInfo.tier} ({statusInfo.label})
                          </span>
                        );
                      })()}

                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={followDriver}
                          onChange={(e) => setFollowDriver(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        Follow
                      </label>
                    </div>
                  </div>
                </div>

                {/* Mobile Expandable Bottom Sheet (< md screens) */}
                <div className="md:hidden absolute bottom-3 inset-x-3 z-20 pointer-events-auto">
                  <div className="bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-xs">{selectedTrip.bookingReference}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border ${getStatusColor(selectedTrip.status)}`}>
                          {selectedTrip.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMobileCardExpanded(!mobileCardExpanded)}
                        className="p-1 text-slate-500 hover:text-slate-800"
                      >
                        {mobileCardExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </button>
                    </div>

                    {mobileCardExpanded && (
                      <div className="pt-1 space-y-2 text-xs border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Driver:</span>
                          <span className="font-bold text-slate-900">{selectedTrip.driverId?.name || "Assigned Driver"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Rider:</span>
                          <span className="font-bold text-slate-900">{selectedRiderName}</span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          {(() => {
                            const statusInfo = getLocationStatus(selectedTrip.driverLocation?.updatedAt);
                            return (
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${statusInfo.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                                {statusInfo.tier}
                              </span>
                            );
                          })()}

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setMobileView("list")}
                              className="text-xs font-bold text-slate-600 hover:text-slate-900"
                            >
                              Switch Trip
                            </button>
                            <Link
                              href={`/admin/trips/${selectedTrip._id}`}
                              className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
                            >
                              Details
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center text-slate-500 p-6">
                <Navigation size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="text-base font-bold text-slate-800">No Active Trips in Transit</p>
                <p className="text-xs text-slate-500 mt-1">When drivers begin assigned rides, live telemetry appears here.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
