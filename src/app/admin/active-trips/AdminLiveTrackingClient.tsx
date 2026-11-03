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
  AlertTriangle 
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
        // Remove from list if finished/cancelled
        setActiveBookings(prev => prev.filter(b => b._id !== data.bookingId));
        if (selectedTripId === data.bookingId) {
          setSelectedTripId(null);
        }
      } else {
        // Update status
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

  const isLocationStale = (updatedAt?: string) => {
    if (!updatedAt) return true;
    const diffMins = (Date.now() - new Date(updatedAt).getTime()) / 60000;
    return diffMins > 2; // Stale if older than 2 minutes
  };

  const selectedRiderName = selectedTrip?.rider?.fullName || selectedTrip?.passengerDetails?.fullName || "Rider name unavailable";
  const selectedRiderPhone = selectedTrip?.rider?.whatsappNumber || (selectedTrip?.passengerDetails?.whatsappNumber !== "No contact provided" ? selectedTrip?.passengerDetails?.whatsappNumber : null) || "No contact provided";

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      
      {/* Top Bar Stats */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="text-blue-600 animate-pulse" size={20} /> Active Trips Fleet
          </h1>
          <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
            {activeBookings.length} Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isConnected && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <AlertTriangle size={14} /> Reconnecting Socket (Polling active)
            </span>
          )}
          <Link href="/admin/trips" className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            All Trips
          </Link>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Trips List */}
        <div className="w-80 md:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0">
          
          {/* Search Header */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search reference, driver, rider..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* List Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-medium">
                No active trips matching query
              </div>
            ) : filteredBookings.map(booking => {
              const stale = isLocationStale(booking.driverLocation?.updatedAt);
              const selected = selectedTripId === booking._id;
              const rName = booking.rider?.fullName || booking.passengerDetails?.fullName || "Rider name unavailable";
              
              return (
                <div 
                  key={booking._id} 
                  onClick={() => setSelectedTripId(booking._id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selected 
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20' 
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-bold text-slate-900">{booking.bookingReference}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${getStatusColor(booking.status)}`}>
                      {booking.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-800 line-clamp-1">{booking.driverId?.name || "Unknown Driver"}</div>
                  <div className="text-xs text-slate-500 line-clamp-1 mb-2">{rName}</div>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                    <div className="flex items-center gap-1 text-xs">
                      {booking.driverLocation?.updatedAt ? (
                        <>
                          {stale ? (
                            <AlertTriangle size={12} className="text-amber-500" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          )}
                          <span className={stale ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
                            {Math.floor((Date.now() - new Date(booking.driverLocation.updatedAt).getTime()) / 60000)}m ago
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">No location data</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content: Map & Details */}
        <div className="flex-1 flex flex-col relative bg-slate-100">
          {selectedTrip ? (
            <>
              {/* Map View */}
              <div className="flex-1 relative">
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

                {/* Map Overlays */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                  
                  {/* Trip Info Card Overlay */}
                  <div className="bg-white/95 backdrop-blur shadow-lg border border-slate-200/60 rounded-2xl p-4 w-80 pointer-events-auto transition-transform">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-slate-900 font-mono">{selectedTrip.bookingReference}</h3>
                      <Link href={`/admin/trips/${selectedTrip._id}`} className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-lg" title="View full details">
                        <ExternalLink size={16} />
                      </Link>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 mt-0.5"><Car size={16} /></div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Driver</p>
                          <p className="text-sm font-bold text-slate-900">{selectedTrip.driverId?.name || "Unknown"}</p>
                          <p className="text-xs text-slate-500">{selectedTrip.driverId?.phoneNumber || "No phone"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-0.5"><User size={16} /></div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Rider</p>
                          <p className="text-sm font-bold text-slate-900">{selectedRiderName}</p>
                          <p className="text-xs text-slate-500">{selectedRiderPhone}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${getStatusColor(selectedTrip.status)}`}>
                          {selectedTrip.status.replace(/_/g, " ")}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {isLocationStale(selectedTrip.driverLocation?.updatedAt) ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                              <AlertTriangle size={12} /> Stale
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Live
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Map Controls */}
                  <div className="pointer-events-auto">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2 cursor-pointer bg-white/95 backdrop-blur px-4 py-2.5 rounded-xl border border-slate-200/60 shadow-lg hover:bg-white transition-colors">
                      <input 
                        type="checkbox" 
                        checked={followDriver}
                        onChange={(e) => setFollowDriver(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      Follow Driver
                    </label>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center text-slate-500">
                <Navigation size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-medium text-slate-900">No Trip Selected</p>
                <p className="text-sm mt-1">Select an active trip from the sidebar to view its live location.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
