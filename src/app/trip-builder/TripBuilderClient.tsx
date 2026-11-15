"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Users, Briefcase, Car, DollarSign, MapPin, Plane, Plus, Trash2, ChevronRight, ChevronLeft, Check, Save, AlertCircle } from "lucide-react";
import PlacesAutocompleteInput, { LocationState } from "@/components/booking/PlacesAutocompleteInput";
import MapLocationPicker from "@/components/booking/MapLocationPicker";
import ItineraryRouteSummary from "@/components/booking/ItineraryRouteSummary";
import { formatSriLankanDate } from "@/lib/dateTime";

interface VehicleType {
  _id: string;
  name: string;
  maxPassengers: number;
  maxLuggage: number;
}

type TripDay = {
  dayNumber: number;
  date: string;
  startingLocation: LocationState | null;
  departureTime: string;
  placesToVisit: { location: LocationState; activityTime: string }[];
  overnightLocation: LocationState | null;
  notes: string;
};

export default function TripBuilderClient({ vehicleTypes, initialData }: { vehicleTypes: VehicleType[], initialData?: any }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Basics
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [luggage, setLuggage] = useState(2);
  const [vehicleTypeId, setVehicleTypeId] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [budgetCovers, setBudgetCovers] = useState("Transport only");
  const [budgetFlexibility, setBudgetFlexibility] = useState("Negotiable");
  const [budgetNotes, setBudgetNotes] = useState("");

  // Step 2: Logistics
  const [pickupLocation, setPickupLocation] = useState<LocationState | null>(null);
  const [pickupTime, setPickupTime] = useState("");
  const [pickupFlight, setPickupFlight] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState<LocationState | null>(null);
  const [dropoffTime, setDropoffTime] = useState("");
  const [dropoffFlight, setDropoffFlight] = useState("");

  // Step 3: Itinerary
  const [itinerary, setItinerary] = useState<TripDay[]>([]);
  const [routeData, setRouteData] = useState<any>(null);

  useEffect(() => {
    if (initialData?.customTripDetails?.itinerary) {
      const mappedItinerary = initialData.customTripDetails.itinerary.map((day: any) => ({
        ...day,
        startingLocation: day.startingLocation ? {
          address: day.startingLocation.address || "",
          lat: day.startingLocation.lat || 0,
          lng: day.startingLocation.lng || 0,
          source: 'local'
        } : null,
        overnightLocation: day.overnightLocation ? {
          address: day.overnightLocation.hotel || day.overnightLocation.city || "",
          lat: day.overnightLocation.lat || 0,
          lng: day.overnightLocation.lng || 0,
          source: 'local'
        } : null,
        placesToVisit: day.placesToVisit ? day.placesToVisit.map((p: any) => ({
          location: {
            address: p.name || "",
            lat: p.lat || 0,
            lng: p.lng || 0,
            source: 'local'
          },
          activityTime: p.activityTime
        })) : []
      }));
      setItinerary(mappedItinerary);
    }
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      if (initialData.arrivalDate) setStartDate(new Date(initialData.arrivalDate).toISOString().split('T')[0]);
      if (initialData.customTripDetails?.endDate) setEndDate(new Date(initialData.customTripDetails.endDate).toISOString().split('T')[0]);
      setAdults(initialData.passengerDetails?.adults || 2);
      setChildren(initialData.passengerDetails?.children || 0);
      setLuggage(initialData.passengerDetails?.luggage || 2);
      setVehicleTypeId(initialData.vehicleTypeId || "");
      setBudget(initialData.customTripDetails?.budget?.toString() || "");
      if (initialData.customTripDetails?.budgetCurrency) setBudgetCurrency(initialData.customTripDetails.budgetCurrency);
      if (initialData.customTripDetails?.budgetCovers) setBudgetCovers(initialData.customTripDetails.budgetCovers);
      if (initialData.customTripDetails?.budgetFlexibility) setBudgetFlexibility(initialData.customTripDetails.budgetFlexibility);
      if (initialData.customTripDetails?.budgetNotes) setBudgetNotes(initialData.customTripDetails.budgetNotes);

      if (initialData.pickupAddress) setPickupLocation({ address: initialData.pickupAddress, lat: initialData.pickupLat || 0, lng: initialData.pickupLng || 0, source: 'local' });
      setPickupTime(initialData.arrivalTime || "");
      setPickupFlight(initialData.flightNumber || "");
      
      if (initialData.destinationAddress) setDropoffLocation({ address: initialData.destinationAddress, lat: initialData.destinationLat || 0, lng: initialData.destinationLng || 0, source: 'local' });
      setDropoffTime(initialData.customTripDetails?.dropoffTime || "");
      setDropoffFlight(initialData.customTripDetails?.dropoffFlightNumber || "");
    }
  }, [initialData]);

  // Calculate days when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays > 0 && diffDays < 30) {
        setItinerary(prev => {
          const newItin = [];
          for (let i = 1; i <= diffDays; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i - 1);
            
            // Try to keep existing data if available
            const existing = prev.find(p => p.dayNumber === i);
            newItin.push(existing || {
              dayNumber: i,
              date: d.toISOString().split('T')[0],
              startingLocation: null,
              departureTime: "08:30",
              placesToVisit: [],
              overnightLocation: null,
              notes: ""
            });
          }
          return newItin;
        });
      }
    }
  }, [startDate, endDate]);

  const handleAddPlace = (dayIndex: number) => {
    const newItin = [...itinerary];
    newItin[dayIndex].placesToVisit.push({ location: { address: '', lat: 0, lng: 0, source: 'local' }, activityTime: "2 hours" });
    setItinerary(newItin);
  };

  const handleUpdatePlace = (dayIndex: number, placeIndex: number, location: LocationState | null) => {
    const newItin = [...itinerary];
    if (location) {
      newItin[dayIndex].placesToVisit[placeIndex].location = location;
    }
    setItinerary(newItin);
  };

  const handleUpdatePlaceTime = (dayIndex: number, placeIndex: number, time: string) => {
    const newItin = [...itinerary];
    newItin[dayIndex].placesToVisit[placeIndex].activityTime = time;
    setItinerary(newItin);
  };

  const handleRemovePlace = (dayIndex: number, placeIndex: number) => {
    const newItin = [...itinerary];
    newItin[dayIndex].placesToVisit.splice(placeIndex, 1);
    setItinerary(newItin);
  };

  const handleUpdateDay = (dayIndex: number, field: keyof TripDay, value: any) => {
    const newItin = [...itinerary];
    (newItin[dayIndex] as any)[field] = value;
    
    // Default next day's starting location to this day's overnight location
    if (field === 'overnightLocation' && dayIndex < newItin.length - 1) {
      if (!newItin[dayIndex + 1].startingLocation || newItin[dayIndex + 1].startingLocation?.address === "") {
        newItin[dayIndex + 1].startingLocation = value;
      }
    }
    
    setItinerary(newItin);
  };

  const validateStep1 = () => {
    if (!startDate || !endDate) return "Please select start and end dates.";
    if (new Date(startDate) > new Date(endDate)) return "Start date must be before end date.";
    if (!vehicleTypeId) return "Please select a vehicle type.";
    if (!budget) return "Please enter your target budget.";
    if (Number(budget) <= 0) return "Budget must be a positive number.";
    return null;
  };

  const validateStep2 = () => {
    if (!pickupLocation) return "Please select a pickup location.";
    if (!pickupTime) return "Please select a pickup time.";
    if (!dropoffLocation) return "Please select a drop-off location.";
    return null;
  };

  const validateStep3 = () => {
    for (let i = 0; i < itinerary.length; i++) {
      if (!itinerary[i].startingLocation) return `Please set a starting location for Day ${i + 1}`;
      if (!itinerary[i].overnightLocation) return `Please set an overnight location for Day ${i + 1}`;
      for (let j = 0; j < itinerary[i].placesToVisit.length; j++) {
        if (!itinerary[i].placesToVisit[j].location.address) {
          return `Please complete all places to visit on Day ${i + 1}`;
        }
      }
    }
    return null;
  };

  const handleNext = () => {
    setError("");
    let err = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (step === 3) err = validateStep3();

    if (err) {
      setError(err);
      return;
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async (isDraft: boolean) => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        bookingId: initialData?._id,
        isDraft,
        basics: { 
          startDate, 
          endDate, 
          adults, 
          children, 
          luggage, 
          vehicleTypeId, 
          budget,
          budgetCurrency,
          budgetCovers,
          budgetFlexibility,
          budgetNotes
        },
        logistics: { pickupLocation, pickupTime, pickupFlight, dropoffLocation, dropoffTime, dropoffFlight },
        itinerary: itinerary.map(day => ({
          ...day,
          distanceKm: routeData?.daySummaries?.[day.dayNumber]?.totalDrivingDistanceKm || 0,
          drivingTimeMins: routeData?.daySummaries?.[day.dayNumber]?.totalDrivingTimeMins || 0,
        })),
        totalDistanceKm: routeData?.totalDistanceKm || 0,
        totalDurationMins: routeData?.totalDurationMins || 0,
      };

      const res = await fetch("/api/bookings/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        router.push("/my-bookings");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save trip request.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Progress Bar */}
      <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 flex justify-between items-center relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-0"></div>
        <div className="absolute top-1/2 left-0 h-0.5 bg-blue-600 transition-all duration-300" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
        
        {[1, 2, 3, 4].map((num) => (
          <div key={num} className={`relative z-10 flex flex-col items-center justify-center bg-slate-50 px-2`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
              step >= num ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-slate-200 text-slate-500'
            }`}>
              {step > num ? <Check size={16} /> : num}
            </div>
            <span className={`text-[10px] font-bold uppercase mt-2 hidden sm:block ${step >= num ? 'text-blue-900' : 'text-slate-400'}`}>
              {num === 1 ? 'Basics' : num === 2 ? 'Logistics' : num === 3 ? 'Itinerary' : 'Review'}
            </span>
          </div>
        ))}
      </div>

      <div className="p-6 sm:p-10">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm font-medium border border-red-100 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* STEP 1: Basics */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold text-slate-900">Trip Basics</h2>
            
            {initialData?.adminNotes?.basics && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
                <p className="text-sm font-bold text-amber-900 flex items-center gap-2"><AlertCircle size={16} /> Admin Feedback - Trip Basics</p>
                <p className="text-sm text-amber-800 mt-1">{initialData.adminNotes.basics}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Date *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="text-slate-400" size={18} />
                  </div>
                  <input type="date" value={startDate} min={new Date().toISOString().split('T')[0]} onChange={e => setStartDate(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">End Date *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="text-slate-400" size={18} />
                  </div>
                  <input type="date" value={endDate} min={startDate || new Date().toISOString().split('T')[0]} onChange={e => setEndDate(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Adults *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="text-slate-400" size={18} /></div>
                  <input type="number" min="1" value={adults} onChange={e => setAdults(Number(e.target.value))} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Children</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="text-slate-400" size={18} /></div>
                  <input type="number" min="0" value={children} onChange={e => setChildren(Number(e.target.value))} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Large Bags</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Briefcase className="text-slate-400" size={18} /></div>
                  <input type="number" min="0" value={luggage} onChange={e => setLuggage(Number(e.target.value))} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-2">Preferred Vehicle *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Car className="text-slate-400" size={18} /></div>
                <select value={vehicleTypeId} onChange={e => setVehicleTypeId(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                  <option value="">Select a vehicle...</option>
                  {vehicleTypes.map(v => (
                    <option key={v._id} value={v._id}>{v.name} (Max {v.maxPassengers} pax, {v.maxLuggage} bags)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><DollarSign size={18} className="text-blue-600"/> Your Trip Budget *</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Budget Amount *</label>
                  <div className="flex gap-2">
                    <select value={budgetCurrency} onChange={e => setBudgetCurrency(e.target.value)} className="w-1/3 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                      <option value="USD">USD</option>
                      <option value="LKR">LKR</option>
                    </select>
                    <input type="number" min="0" placeholder="e.g. 500" value={budget} onChange={e => setBudget(e.target.value)} className="w-2/3 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Budget Covers</label>
                  <select value={budgetCovers} onChange={e => setBudgetCovers(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                    <option value="Transport only">Transport only</option>
                    <option value="Entire trip">Entire trip (Hotels, Activities, etc.)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Flexibility</label>
                  <select value={budgetFlexibility} onChange={e => setBudgetFlexibility(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                    <option value="Negotiable">Negotiable</option>
                    <option value="Fixed maximum">Fixed maximum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Notes on Budget</label>
                  <input type="text" placeholder="e.g. Can increase if hotels are included" value={budgetNotes} onChange={e => setBudgetNotes(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Logistics */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold text-slate-900">Pickup & Drop-off Logistics</h2>
            
            {initialData?.adminNotes?.logistics && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
                <p className="text-sm font-bold text-amber-900 flex items-center gap-2"><AlertCircle size={16} /> Admin Feedback - Logistics</p>
                <p className="text-sm text-amber-800 mt-1">{initialData.adminNotes.logistics}</p>
              </div>
            )}
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><MapPin size={18} className="text-blue-600"/> Initial Pickup</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <PlacesAutocompleteInput 
                    label="Pickup Location (Search or Type) *" 
                    placeholder="E.g. Colombo Airport, Hotel Name, City"
                    value={pickupLocation} 
                    onChange={setPickupLocation} 
                  />
                  <MapLocationPicker
                    label="Or select Pickup on Map"
                    value={pickupLocation}
                    onChange={setPickupLocation}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Pickup Time *</label>
                  <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Arrival Flight No. (Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Plane className="text-slate-400" size={18} /></div>
                    <input type="text" placeholder="e.g. UL 504" value={pickupFlight} onChange={e => setPickupFlight(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><MapPin size={18} className="text-slate-600"/> Final Drop-off</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <PlacesAutocompleteInput 
                    label="Drop-off Location (Search or Type) *" 
                    placeholder="E.g. Colombo Airport, Hotel Name, City"
                    value={dropoffLocation} 
                    onChange={setDropoffLocation} 
                  />
                  <MapLocationPicker
                    label="Or select Drop-off on Map"
                    value={dropoffLocation}
                    onChange={setDropoffLocation}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Drop-off Time *</label>
                  <input type="time" value={dropoffTime} onChange={e => setDropoffTime(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Departure Flight No. (Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Plane className="text-slate-400" size={18} /></div>
                    <input type="text" placeholder="e.g. UL 505" value={dropoffFlight} onChange={e => setDropoffFlight(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Itinerary Builder */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Day-by-Day Itinerary</h2>
              <p className="text-sm text-slate-500">Plan out each day of your {itinerary.length} day trip. The first day starts on {startDate}.</p>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="flex-1 space-y-12 w-full min-w-0">
                {itinerary.map((day, dayIndex) => (
                  <div key={day.dayNumber} className="relative border-l-2 border-slate-200 pl-6 pb-4">
                    <div className="absolute -left-[17px] top-0 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">
                      {day.dayNumber}
                    </div>
                    
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <h3 className="font-bold text-lg text-slate-800">Day {day.dayNumber} - {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}</h3>
                      </div>

                      {initialData?.adminNotes?.[`day_${day.dayNumber}`] && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
                          <p className="text-sm font-bold text-amber-900 flex items-center gap-2"><AlertCircle size={16} /> Admin Feedback - Day {day.dayNumber}</p>
                          <p className="text-sm text-amber-800 mt-1">{initialData.adminNotes[`day_${day.dayNumber}`]}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <PlacesAutocompleteInput 
                            label="Starting Location *" 
                            placeholder="Where does the day begin?"
                            value={day.startingLocation} 
                            onChange={(loc) => handleUpdateDay(dayIndex, 'startingLocation', loc)} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Departure Time</label>
                          <input type="time" value={day.departureTime} onChange={e => handleUpdateDay(dayIndex, 'departureTime', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>

                      {/* Places to Visit */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-700">Places to Visit</h4>
                        {day.placesToVisit.map((place, placeIndex) => (
                          <div key={placeIndex} className="flex flex-col md:flex-row gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 relative group">
                            <div className="flex-1">
                              <PlacesAutocompleteInput 
                                label="" 
                                placeholder="E.g. Sigiriya Rock, Galle Fort"
                                value={place.location} 
                                onChange={(loc) => handleUpdatePlace(dayIndex, placeIndex, loc)} 
                              />
                            </div>
                            <div className="w-full md:w-48 shrink-0">
                              <select value={place.activityTime} onChange={e => handleUpdatePlaceTime(dayIndex, placeIndex, e.target.value)} className="w-full px-4 py-[13px] bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="Pass by">Pass by</option>
                                <option value="1 hour">1 hour</option>
                                <option value="2 hours">2 hours</option>
                                <option value="3 hours">3 hours</option>
                                <option value="Half day">Half day</option>
                              </select>
                            </div>
                            <button onClick={() => handleRemovePlace(dayIndex, placeIndex)} className="w-10 h-[46px] flex items-center justify-center text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                        <button onClick={() => handleAddPlace(dayIndex)} className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
                          <Plus size={16} /> Add Stop / Attraction
                        </button>
                      </div>

                      {/* Overnight */}
                      <div className="pt-4 border-t border-slate-100">
                        <PlacesAutocompleteInput 
                          label="Overnight Location (City / Hotel) *" 
                          placeholder="Where are you sleeping tonight?"
                          value={day.overnightLocation} 
                          onChange={(loc) => handleUpdateDay(dayIndex, 'overnightLocation', loc)} 
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Notes for Driver (Optional)</label>
                        <textarea rows={2} value={day.notes} onChange={e => handleUpdateDay(dayIndex, 'notes', e.target.value)} placeholder="E.g. Prefer scenic route, need to stop for lunch at 1pm" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"></textarea>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
              <div className="w-full lg:w-96 shrink-0 min-w-0">
                <ItineraryRouteSummary itinerary={itinerary} onRouteCalculated={setRouteData} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold text-slate-900">Review Trip Request</h2>

            {/* Trip Overview */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600" /> Trip Overview
                </h3>
                <button onClick={() => setStep(1)} className="text-sm font-bold text-blue-600 hover:text-blue-700">Edit</button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dates</p>
                  <p className="font-medium text-slate-900" suppressHydrationWarning>
                    {formatSriLankanDate(startDate)} - {formatSriLankanDate(endDate)}
                  </p>
                  <p className="text-sm text-slate-500">{itinerary.length} Days, {itinerary.length - 1} Nights</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Passengers</p>
                  <p className="font-medium text-slate-900">{adults} Adults, {children} Children</p>
                  <p className="text-sm text-slate-500">{luggage} Large Bags</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Vehicle Preference</p>
                  <p className="font-medium text-slate-900">{vehicleTypes.find(v => v._id === vehicleTypeId)?.name || "Not selected"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Rider's Proposed Budget</p>
                  <p className="font-medium text-slate-900">{budget ? `${budgetCurrency} ${budget}` : 'Flexible'}</p>
                  {budget && (
                    <p className="text-xs text-slate-500 mt-1">
                      {budgetCovers} • {budgetFlexibility}
                    </p>
                  )}
                  {budgetNotes && <p className="text-xs text-amber-700 bg-amber-50 p-1 rounded mt-1 line-clamp-2" title={budgetNotes}>{budgetNotes}</p>}
                </div>
              </div>
            </div>

            {/* Arrival & Departure */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <MapPin size={18} className="text-blue-600" /> Arrival & Departure
                </h3>
                <button onClick={() => setStep(2)} className="text-sm font-bold text-blue-600 hover:text-blue-700">Edit</button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Initial Pickup</p>
                  <div>
                    <p className="font-medium text-slate-900">{pickupLocation?.address || "Not set"}</p>
                    <p className="text-sm text-slate-500">Time: {pickupTime || "Not set"}</p>
                    {pickupFlight && <p className="text-sm text-slate-500">Flight: {pickupFlight}</p>}
                  </div>
                  {pickupLocation?.source === 'gps' && (
                    <div className="h-32 w-full bg-slate-100 rounded-xl overflow-hidden pointer-events-none opacity-80 mt-2">
                       <MapLocationPicker label="" value={pickupLocation} onChange={() => {}} />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Final Drop-off</p>
                  <div>
                    <p className="font-medium text-slate-900">{dropoffLocation?.address || "Not set"}</p>
                    <p className="text-sm text-slate-500">Time: {dropoffTime || "Not set"}</p>
                    {dropoffFlight && <p className="text-sm text-slate-500">Flight: {dropoffFlight}</p>}
                  </div>
                  {dropoffLocation?.source === 'gps' && (
                    <div className="h-32 w-full bg-slate-100 rounded-xl overflow-hidden pointer-events-none opacity-80 mt-2">
                       <MapLocationPicker label="" value={dropoffLocation} onChange={() => {}} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Complete Itinerary */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Car size={18} className="text-blue-600" /> Complete Itinerary
                </h3>
                <button onClick={() => setStep(3)} className="text-sm font-bold text-blue-600 hover:text-blue-700">Edit</button>
              </div>
              <div className="p-0">
                {itinerary.map(day => {
                  const summary = routeData?.daySummaries?.[day.dayNumber];
                  
                  return (
                    <div key={day.dayNumber} className="border-b border-slate-100 last:border-0">
                      <details className="group" open>
                        <summary className="flex justify-between items-center p-6 cursor-pointer hover:bg-slate-50">
                          <div>
                            <p className="font-bold text-slate-800 text-lg">Day {day.dayNumber} - {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}</p>
                            <p className="text-sm text-slate-500">{day.startingLocation?.address?.split(',')[0]} → {day.overnightLocation?.address?.split(',')[0]}</p>
                          </div>
                          <ChevronRight className="text-slate-400 group-open:rotate-90 transition-transform" />
                        </summary>
                        
                        <div className="px-6 pb-6 pt-2 space-y-6">
                          <div className="pl-6 border-l-2 border-slate-200 space-y-6 relative">
                            {/* Start */}
                            <div className="relative">
                              <div className="absolute -left-[31px] bg-slate-200 w-4 h-4 rounded-full border-4 border-white"></div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Start • {day.departureTime || "Time not set"}</p>
                              <p className="font-medium text-slate-900">{day.startingLocation?.address || "Not set"}</p>
                            </div>

                            {/* Stops */}
                            {day.placesToVisit.map((place, idx) => (
                              <div key={idx} className="relative pt-2">
                                <div className="absolute -left-[31px] bg-blue-500 w-4 h-4 rounded-full border-4 border-white"></div>
                                {summary?.isValid && summary.segments[idx] && (
                                  <div className="absolute -top-6 -left-[27px] pl-8 text-[11px] text-slate-500 bg-white py-1">
                                    🚗 {summary.segments[idx].distanceKm.toFixed(1)} km • {Math.round(summary.segments[idx].durationMins)} mins
                                  </div>
                                )}
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Stop {idx + 1}</p>
                                <p className="font-medium text-slate-900">{place.location.address}</p>
                                <p className="text-sm text-slate-500 mt-1">Planned Activity: {place.activityTime}</p>
                              </div>
                            ))}

                            {/* Overnight */}
                            <div className="relative pt-2">
                              <div className="absolute -left-[31px] bg-slate-800 w-4 h-4 rounded-full border-4 border-white"></div>
                              {summary?.isValid && summary.segments[day.placesToVisit.length] && (
                                <div className="absolute -top-6 -left-[27px] pl-8 text-[11px] text-slate-500 bg-white py-1">
                                  🚗 {summary.segments[day.placesToVisit.length].distanceKm.toFixed(1)} km • {Math.round(summary.segments[day.placesToVisit.length].durationMins)} mins
                                </div>
                              )}
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Overnight</p>
                              <p className="font-medium text-slate-900">{day.overnightLocation?.address || "Not set"}</p>
                            </div>
                          </div>

                          {day.notes && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                              <p className="text-sm font-bold text-amber-800 mb-1">Notes for Driver</p>
                              <p className="text-sm text-amber-700">{day.notes}</p>
                            </div>
                          )}

                          {summary?.isValid ? (
                            <div className="bg-slate-50 p-4 rounded-xl flex flex-wrap gap-6 text-sm">
                              <div>
                                <span className="text-slate-500">Day Driving Dist:</span> <span className="font-bold text-slate-900">{summary.totalDrivingDistanceKm.toFixed(1)} km</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Day Driving Time:</span> <span className="font-bold text-slate-900">{Math.round(summary.totalDrivingTimeMins / 60)}h {Math.round(summary.totalDrivingTimeMins % 60)}m</span>
                              </div>
                              {summary.totalActivityTimeMins > 0 && (
                                <div>
                                  <span className="text-slate-500">Activity Time:</span> <span className="font-bold text-slate-900">{Math.round(summary.totalActivityTimeMins / 60)}h {Math.round(summary.totalActivityTimeMins % 60)}m</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-red-50 p-4 rounded-xl text-sm text-red-600">
                              Route unavailable for this day. (Missing coordinates or routing error)
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Whole Trip Summary */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between gap-6 items-center shadow-lg">
              <div className="space-y-2 text-center md:text-left w-full md:w-auto">
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Driving Distance</p>
                <p className="text-3xl font-black">{routeData?.totalDistanceKm ? routeData.totalDistanceKm.toFixed(0) : 0} km</p>
              </div>
              <div className="space-y-2 text-center md:text-left w-full md:w-auto">
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Est. Driving Time</p>
                <p className="text-3xl font-black">
                  {routeData?.totalDurationMins 
                    ? `${Math.floor(routeData.totalDurationMins / 60)}h ${Math.round(routeData.totalDurationMins % 60)}m` 
                    : "0h 0m"}
                </p>
              </div>
              <div className="space-y-2 text-center md:text-right w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-700 pt-6 md:pt-0 md:pl-8">
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Estimated Price</p>
                <p className="text-2xl font-bold text-yellow-400">Awaiting driver quote</p>
                <p className="text-xs text-slate-500">Subject to your final approval</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Navigation Footer */}
      <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-6 flex justify-between items-center">
        {step > 1 ? (
          <button onClick={() => setStep(s => s - 1)} disabled={loading} className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-2">
            <ChevronLeft size={18} /> Back
          </button>
        ) : <div></div>}

        <div className="flex gap-3">
          {step === 4 ? (
            <>
              <button onClick={() => handleSubmit(true)} disabled={loading} className="px-6 py-3 font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50">
                <Save size={18} /> {loading ? "Saving..." : "Save Draft"}
              </button>
              <button onClick={() => handleSubmit(false)} disabled={loading} className="px-8 py-3 font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50">
                {loading ? "Submitting..." : "Submit Trip Request"} <Check size={18} />
              </button>
            </>
          ) : (
            <button onClick={handleNext} className="px-8 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 rounded-xl transition-colors flex items-center gap-2">
              Next Step <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
