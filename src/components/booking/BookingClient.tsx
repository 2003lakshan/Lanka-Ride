"use client";

import { useState } from "react";
import { Users, Briefcase, Fuel, Info, ArrowRight } from "lucide-react";

type Airport = any;
type Vehicle = any;

import PassengerForm from "./PassengerForm";
import RouteMap from "./Map";

import PlacesAutocompleteInput, { LocationState } from "./PlacesAutocompleteInput";

interface BookingClientProps {
  initialAirports: Airport[];
  initialVehicles: Vehicle[];
}

export default function BookingClient({ initialAirports, initialVehicles }: BookingClientProps) {
  // Try to find CMB airport to use as default pickup
  const defaultCMB = initialAirports.find(a => a.code === 'CMB');
  
  const [origin, setOrigin] = useState<LocationState | null>(defaultCMB ? {
    address: defaultCMB.address,
    lat: defaultCMB.lat || 7.1804,
    lng: defaultCMB.lng || 79.8833,
    source: 'local'
  } : null);
  const [destination, setDestination] = useState<LocationState | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMins: number; polyline?: string; status?: string } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [showPassengerForm, setShowPassengerForm] = useState(false);
  const [bookingSuccessRef, setBookingSuccessRef] = useState<string | null>(null);

  const [routeError, setRouteError] = useState<string | null>(null);

  const [step, setStep] = useState(1);

  const handleCalculateRoute = async () => {
    if (!origin || !destination) return;
    
    setLoadingRoute(true);
    setRouteError(null);
    try {
      const res = await fetch("/api/calculate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: origin.address, destination: destination.address }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setRouteInfo(data);
        setStep(2); // Automatically advance to vehicle selection
      } else {
        setRouteError(data.error || "Failed to calculate route");
      }
    } catch (error: any) {
      console.error("Failed to calculate route:", error);
      setRouteError(error.message || "Failed to calculate route");
    } finally {
      setLoadingRoute(false);
    }
  };

  const calculateFareBreakdown = (vehicle: Vehicle) => {
    if (!routeInfo || !origin) return null;
    
    // Check if origin matches any airport to apply pickup charge
    const airport = initialAirports.find((a) => origin.address.includes(a.name) || origin.address.includes(a.code) || origin.address === a.address);
    const airportPickupCharge = airport ? airport.pickupCharge : 0;
    const distanceCharge = routeInfo.distanceKm * vehicle.pricePerKm;
    
    let totalEstimatedFare = vehicle.baseCharge + distanceCharge + airportPickupCharge;
    
    if (totalEstimatedFare < vehicle.minFare) {
      totalEstimatedFare = vehicle.minFare;
    }
    
    return {
      baseCharge: vehicle.baseCharge,
      distanceCharge: Math.round(distanceCharge),
      airportPickupCharge,
      trafficCharge: 0,
      nightCharge: 0,
      highwayToll: 0,
      additionalCharges: 0,
      discount: 0,
      totalEstimatedFare: Math.round(totalEstimatedFare)
    };
  };

  if (bookingSuccessRef) {
    return (
      <div className="bg-white/80 backdrop-blur-xl p-10 md:p-16 rounded-3xl shadow-2xl border border-slate-100 text-center flex flex-col items-center max-w-2xl mx-auto transform transition-all mt-10">
        <div className="bg-gradient-to-br from-green-400 to-emerald-600 text-white p-5 rounded-full mb-8 shadow-lg shadow-green-500/30">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Booking Confirmed!</h2>
        <div className="bg-slate-50 border border-slate-200 px-8 py-4 rounded-2xl mb-8 inline-block shadow-inner">
          <p className="text-slate-500 text-sm uppercase font-bold tracking-widest mb-1">Booking Reference</p>
          <p className="text-3xl font-black text-slate-900 tracking-wider">{bookingSuccessRef}</p>
        </div>
        <p className="text-slate-600 mb-10 text-lg leading-relaxed">
          We have sent a confirmation email with all the details. Your driver will meet you at the airport arrivals area holding a sign with your name.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={() => window.location.href = "/track"}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-600/30 transition-all"
          >
            Track Booking
          </button>
          <button 
            onClick={() => window.location.href = "/"}
            className="bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 px-8 py-4 rounded-xl font-bold text-lg transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (showPassengerForm && selectedVehicle && routeInfo && origin && destination) {
    const vehicle = initialVehicles.find(v => v._id === selectedVehicle);
    const fareBreakdown = calculateFareBreakdown(vehicle);
    
    // Find matching airport ID if any
    const matchingAirport = initialAirports.find((a) => origin.address.includes(a.name) || origin.address.includes(a.code) || origin.address === a.address);
    const airportId = matchingAirport ? matchingAirport._id : null;
    
    return (
      <div className="max-w-4xl mx-auto">
        {/* Stepper Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-blue-600 rounded-full z-0 transition-all"></div>
            
            <div className="relative z-10 flex flex-col items-center gap-2 cursor-pointer" onClick={() => {setShowPassengerForm(false); setStep(1);}}>
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center border-4 border-slate-50">✓</div>
              <span className="text-sm font-bold text-slate-700">Route</span>
            </div>
            <div className="relative z-10 flex flex-col items-center gap-2 cursor-pointer" onClick={() => setShowPassengerForm(false)}>
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center border-4 border-slate-50">✓</div>
              <span className="text-sm font-bold text-slate-700">Vehicle</span>
            </div>
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center border-4 border-slate-50 shadow-md">3</div>
              <span className="text-sm font-bold text-blue-700">Details</span>
            </div>
          </div>
        </div>
        
        <PassengerForm 
          onBack={() => setShowPassengerForm(false)}
          onSubmitSuccess={(ref) => setBookingSuccessRef(ref)}
          routeInfo={routeInfo}
          vehicle={vehicle}
          origin={origin}
          destination={destination}
          airportId={airportId}
          fareBreakdown={fareBreakdown}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Stepper Header */}
      <div className="mb-10 lg:px-20">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0"></div>
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 rounded-full z-0 transition-all duration-500 ease-in-out ${step === 2 ? 'w-1/2' : 'w-0'}`}></div>
          
          <div className="relative z-10 flex flex-col items-center gap-2 cursor-pointer" onClick={() => setStep(1)}>
            <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center border-4 border-slate-50 transition-all ${step >= 1 ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-300 text-slate-600'}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <span className={`text-sm font-bold ${step >= 1 ? 'text-blue-700' : 'text-slate-500'}`}>Route</span>
          </div>
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center border-4 border-slate-50 transition-all ${step >= 2 ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
              2
            </div>
            <span className={`text-sm font-bold ${step >= 2 ? 'text-blue-700' : 'text-slate-400'}`}>Vehicle</span>
          </div>
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 font-bold flex items-center justify-center border-4 border-slate-50 transition-all">3</div>
            <span className="text-sm font-bold text-slate-400">Details</span>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${step === 1 ? 'lg:grid-cols-2 max-w-4xl mx-auto' : 'lg:grid-cols-3'} gap-8 transition-all`}>
        {/* Left Column: Form & Route */}
        <div className={`space-y-6 ${step === 1 ? 'lg:col-span-1' : 'lg:col-span-1'} transition-all`}>
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100">
            <h2 className="text-2xl font-extrabold text-slate-900 mb-8 flex items-center gap-2">
              <span className="w-8 h-1 bg-blue-600 rounded-full block"></span>
              Trip Route
            </h2>
            
            <div className="relative pl-8 space-y-8">
              {/* Visual Line */}
              <div className="absolute left-[11px] top-4 bottom-4 w-1 bg-slate-100 rounded-full"></div>
              
              {/* Pickup */}
              <div className="relative">
                <div className="absolute -left-[35.5px] top-4 w-5 h-5 rounded-full bg-slate-900 border-4 border-white shadow-md z-10"></div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pickup Location</label>
                <PlacesAutocompleteInput 
                  label="Pickup Location"
                  placeholder="e.g. Colombo Airport, Hotel..."
                  value={origin}
                  onChange={(val) => {
                    setOrigin(val);
                    if(step === 2) setStep(1);
                  }}
                />
              </div>
              
              {/* Dropoff */}
              <div className="relative">
                <div className="absolute -left-[35.5px] top-4 w-5 h-5 rounded-full bg-blue-600 border-4 border-white shadow-md shadow-blue-500/40 z-10"></div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Drop Location</label>
                <PlacesAutocompleteInput 
                  label="Drop Location"
                  placeholder="e.g. Galle Fort, Kandy..."
                  value={destination}
                  onChange={(val) => {
                    setDestination(val);
                    if(step === 2) setStep(1);
                  }}
                />
              </div>
            </div>
            
            {routeError && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <span>{routeError}</span>
              </div>
            )}

            {step === 1 && (
              <button 
                onClick={handleCalculateRoute}
                disabled={loadingRoute || !origin || !destination}
                className="w-full mt-8 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-2xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-600/20 flex justify-center items-center group"
              >
                {loadingRoute ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Calculating...
                  </span>
                ) : (
                  <>Continue <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            )}
          </div>

          {routeInfo && step === 2 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 md:p-8 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl"></div>
              <h3 className="font-extrabold text-blue-900 mb-6 text-xl">Trip Summary</h3>
              
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center text-slate-700 bg-white/60 p-4 rounded-2xl border border-white">
                  <span className="font-medium">Total Distance</span>
                  <span className="font-black text-blue-900 text-lg">
                    {routeInfo.status === 'unavailable' ? 'Driving distance unavailable' : `${routeInfo.distanceKm} km`}
                  </span>
                </div>
                {routeInfo.status !== 'unavailable' && (
                  <div className="flex justify-between items-center text-slate-700 bg-white/60 p-4 rounded-2xl border border-white">
                    <span className="font-medium">Est. Travel Time</span>
                    <span className="font-black text-blue-900 text-lg">{Math.floor(routeInfo.durationMins / 60)}h {routeInfo.durationMins % 60}m</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Vehicles or Empty State */}
        <div className={step === 1 ? 'lg:col-span-1 hidden lg:block' : 'lg:col-span-2'}>
          
          {step === 1 ? (
             <div className="h-full bg-slate-100/50 border border-slate-200/50 border-dashed rounded-3xl flex flex-col items-center justify-center p-12 text-center text-slate-400">
                <Info size={64} className="mb-6 opacity-30" />
                <h3 className="text-xl font-bold text-slate-500 mb-2">Select your route</h3>
                <p className="max-w-xs text-sm">Enter your pickup and dropoff locations to view available vehicles, live routes, and precise fares.</p>
             </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              {routeInfo && (
                <div className="w-full h-[350px] mb-8 rounded-3xl overflow-hidden shadow-lg shadow-slate-200/50 border border-slate-100 relative">
                  <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-md border border-slate-100 font-bold text-sm text-slate-700">
                    Calculated Route
                  </div>
                  <RouteMap 
                    origin={origin} 
                    destination={destination}
                  />
                </div>
              )}
              
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900">Select Vehicle</h2>
                <span className="text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-lg text-sm">{initialVehicles.length} Options</span>
              </div>
              
              <div className="space-y-5">
                {initialVehicles.map((vehicle) => {
                  const fareBreakdown = calculateFareBreakdown(vehicle);
                  const isSelected = selectedVehicle === vehicle._id;
                  
                  if (!fareBreakdown) return null;
                  const fare = fareBreakdown.totalEstimatedFare;
                  
                  return (
                    <div 
                      key={vehicle._id}
                      onClick={() => setSelectedVehicle(vehicle._id)}
                      className={`bg-white p-6 md:p-8 rounded-3xl border-2 cursor-pointer transition-all duration-300 ${
                        isSelected 
                          ? "border-blue-600 shadow-xl shadow-blue-600/10 ring-4 ring-blue-50 transform scale-[1.01]" 
                          : "border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md"
                      } flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group`}
                    >
                      {isSelected && (
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
                      )}

                      <div className="w-full md:w-48 h-32 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-100">
                         {vehicle.image ? (
                            <img src={vehicle.image} alt={vehicle.name} className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`} />
                         ) : (
                            <span className="text-slate-400 font-bold text-sm tracking-widest uppercase">[No Image]</span>
                         )}
                      </div>
                      
                      <div className="flex-1 w-full">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-4">
                          <div>
                            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{vehicle.name}</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1">{vehicle.description}</p>
                          </div>
                          <div className="text-left md:text-right bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none w-full md:w-auto">
                            {routeInfo?.status === 'unavailable' ? (
                              <>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pricing</div>
                                <div className="text-xl font-black text-blue-700">Request Quote</div>
                                <div className="text-xs text-slate-500 mt-1">Distance unknown</div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Fare</div>
                                <div className="text-2xl font-black text-blue-700">LKR {fare.toLocaleString()}</div>
                                <div className="text-sm font-medium text-slate-500 mt-1">~ USD {Math.round(fare / 300)}</div>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600 mt-6">
                          <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60">
                            <Users size={16} className="text-slate-500" />
                            <span>Up to {vehicle.maxPassengers}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60">
                            <Briefcase size={16} className="text-slate-500" />
                            <span>{vehicle.maxLuggage} bags</span>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60">
                            <Fuel size={16} className="text-slate-500" />
                            <span>{vehicle.fuelType}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {selectedVehicle && (
                  <div className="mt-10 pt-8 border-t border-slate-200 flex justify-end animate-in fade-in slide-in-from-bottom-4">
                    <button 
                      onClick={() => setShowPassengerForm(true)}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-600/30 transition-all flex items-center gap-3 transform hover:-translate-y-1"
                    >
                      Continue to Details <ArrowRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
