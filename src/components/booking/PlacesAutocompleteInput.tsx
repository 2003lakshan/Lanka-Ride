"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { MapPin, Search, Navigation, AlertCircle, Loader2 } from "lucide-react";

export interface LocationState {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
  source: 'google' | 'local' | 'gps';
}

interface PlacesAutocompleteInputProps {
  label: string;
  placeholder?: string;
  value: LocationState | null;
  onChange: (location: LocationState | null) => void;
  icon?: React.ReactNode;
  defaultOptions?: boolean;
}

// Curated local list of popular cities and tourist destinations in Sri Lanka
const LOCAL_PLACES = [
  // Airports
  { address: "Bandaranaike International Airport (CMB), Katunayake", lat: 7.1804, lng: 79.8833, type: "airport" },
  { address: "Mattala Rajapaksa International Airport (HRI), Hambantota", lat: 6.2863, lng: 81.1215, type: "airport" },
  { address: "Ratmalana Airport, Colombo", lat: 6.8222, lng: 79.8804, type: "airport" },
  
  // Western Province (Colombo, Gampaha, Kalutara)
  { address: "Colombo Fort, Colombo", lat: 6.9333, lng: 79.8458, type: "city" },
  { address: "Pettah, Colombo", lat: 6.9389, lng: 79.8517, type: "city" },
  { address: "Bambalapitiya, Colombo", lat: 6.8926, lng: 79.8548, type: "city" },
  { address: "Wellawatte, Colombo", lat: 6.8741, lng: 79.8606, type: "city" },
  { address: "Dehiwala, Colombo", lat: 6.8402, lng: 79.8712, type: "city" },
  { address: "Mount Lavinia, Colombo", lat: 6.8375, lng: 79.8653, type: "city" },
  { address: "Mount Lavinia Beach, Colombo", lat: 6.8341, lng: 79.8631, type: "beach" },
  { address: "Nugegoda, Colombo", lat: 6.8649, lng: 79.8997, type: "city" },
  { address: "Maharagama, Colombo", lat: 6.8471, lng: 79.9272, type: "city" },
  { address: "Negombo, Gampaha", lat: 7.2088, lng: 79.8362, type: "city" },
  { address: "Negombo Beach, Gampaha", lat: 7.2307, lng: 79.8394, type: "beach" },
  { address: "Ja-Ela, Gampaha", lat: 7.0789, lng: 79.8906, type: "city" },
  { address: "Wattala, Gampaha", lat: 6.9892, lng: 79.8914, type: "city" },
  { address: "Gampaha", lat: 7.0873, lng: 79.9996, type: "city" },
  { address: "Kalutara", lat: 6.5854, lng: 79.9607, type: "city" },
  { address: "Panadura, Kalutara", lat: 6.7132, lng: 79.9073, type: "city" },
  { address: "Beruwala, Kalutara", lat: 6.4800, lng: 79.9822, type: "city" },
  { address: "Aluthgama, Kalutara", lat: 6.4357, lng: 80.0001, type: "city" },
  { address: "Bentota, Kalutara", lat: 6.4251, lng: 79.9961, type: "city" },
  { address: "Bentota Beach, Kalutara", lat: 6.4190, lng: 79.9922, type: "beach" },

  // Central Province (Kandy, Matale, Nuwara Eliya)
  { address: "Kandy", lat: 7.2906, lng: 80.6337, type: "city" },
  { address: "Temple of the Tooth, Kandy", lat: 7.2936, lng: 80.6413, type: "heritage" },
  { address: "Kandy Railway Station", lat: 7.2891, lng: 80.6322, type: "transport" },
  { address: "Royal Botanic Gardens Peradeniya, Kandy", lat: 7.2711, lng: 80.5956, type: "nature" },
  { address: "Peradeniya, Kandy", lat: 7.2681, lng: 80.5960, type: "city" },
  { address: "Katugastota, Kandy", lat: 7.3235, lng: 80.6200, type: "city" },
  { address: "Kundasale, Kandy", lat: 7.2885, lng: 80.6865, type: "city" },
  { address: "Matale", lat: 7.4675, lng: 80.6234, type: "city" },
  { address: "Dambulla, Matale", lat: 7.8681, lng: 80.6545, type: "city" },
  { address: "Dambulla Cave Temple, Matale", lat: 7.8566, lng: 80.6485, type: "heritage" },
  { address: "Sigiriya, Matale", lat: 7.9541, lng: 80.7547, type: "city" },
  { address: "Sigiriya Rock Fortress, Matale", lat: 7.9570, lng: 80.7603, type: "heritage" },
  { address: "Nuwara Eliya", lat: 6.9497, lng: 80.7828, type: "city" },
  { address: "Hatton, Nuwara Eliya", lat: 6.8906, lng: 80.5960, type: "city" },
  { address: "Nanu Oya, Nuwara Eliya", lat: 6.9308, lng: 80.7410, type: "city" },
  { address: "Nallathanniya (Adam's Peak), Nuwara Eliya", lat: 6.8222, lng: 80.5186, type: "nature" },
  { address: "Adam's Peak", lat: 6.8096, lng: 80.4994, type: "nature" },
  { address: "Horton Plains National Park", lat: 6.8028, lng: 80.8068, type: "nature" },
  { address: "World's End, Nuwara Eliya", lat: 6.7865, lng: 80.8242, type: "nature" },
  { address: "Gregory Lake, Nuwara Eliya", lat: 6.9538, lng: 80.7788, type: "nature" },
  { address: "Hakgala Botanical Garden, Nuwara Eliya", lat: 6.9270, lng: 80.8227, type: "nature" },

  // Southern Province (Galle, Matara, Hambantota)
  { address: "Galle", lat: 6.0535, lng: 80.2210, type: "city" },
  { address: "Galle Fort, Galle", lat: 6.0267, lng: 80.2168, type: "heritage" },
  { address: "Galle Railway Station", lat: 6.0336, lng: 80.2148, type: "transport" },
  { address: "Hikkaduwa, Galle", lat: 6.1395, lng: 80.1063, type: "city" },
  { address: "Hikkaduwa Beach, Galle", lat: 6.1422, lng: 80.1009, type: "beach" },
  { address: "Unawatuna, Galle", lat: 6.0115, lng: 80.2465, type: "city" },
  { address: "Unawatuna Beach, Galle", lat: 6.0094, lng: 80.2482, type: "beach" },
  { address: "Ambalangoda, Galle", lat: 6.2333, lng: 80.0500, type: "city" },
  { address: "Ahangama, Galle", lat: 5.9678, lng: 80.3653, type: "city" },
  { address: "Matara", lat: 5.9549, lng: 80.5469, type: "city" },
  { address: "Weligama, Matara", lat: 5.9749, lng: 80.4284, type: "city" },
  { address: "Weligama Beach, Matara", lat: 5.9715, lng: 80.4237, type: "beach" },
  { address: "Mirissa, Matara", lat: 5.9483, lng: 80.4716, type: "city" },
  { address: "Mirissa Beach, Matara", lat: 5.9450, lng: 80.4593, type: "beach" },
  { address: "Dikwella, Matara", lat: 5.9688, lng: 80.6860, type: "city" },
  { address: "Hambantota", lat: 6.1246, lng: 81.1185, type: "city" },
  { address: "Tangalle, Hambantota", lat: 6.0242, lng: 80.7941, type: "city" },
  { address: "Tangalle Beach, Hambantota", lat: 6.0248, lng: 80.8039, type: "beach" },
  { address: "Tissamaharama, Hambantota", lat: 6.2798, lng: 81.2866, type: "city" },
  { address: "Yala National Park", lat: 6.3683, lng: 81.5173, type: "nature" },

  // Northern Province (Jaffna, Kilinochchi, Mannar, Vavuniya, Mullaitivu)
  { address: "Jaffna", lat: 9.6615, lng: 80.0255, type: "city" },
  { address: "Nallur, Jaffna", lat: 9.6738, lng: 80.0304, type: "city" },
  { address: "Nallur Kandaswamy Kovil, Jaffna", lat: 9.6744, lng: 80.0300, type: "heritage" },
  { address: "Chavakachcheri, Jaffna", lat: 9.6534, lng: 80.1472, type: "city" },
  { address: "Point Pedro, Jaffna", lat: 9.8167, lng: 80.2333, type: "city" },
  { address: "Kilinochchi", lat: 9.3803, lng: 80.3770, type: "city" },
  { address: "Paranthan, Kilinochchi", lat: 9.4344, lng: 80.4072, type: "city" },
  { address: "Mannar", lat: 8.9810, lng: 79.9044, type: "city" },
  { address: "Talaimannar, Mannar", lat: 9.1022, lng: 79.7153, type: "city" },
  { address: "Vavuniya", lat: 8.7514, lng: 80.4971, type: "city" },
  { address: "Omanthai, Vavuniya", lat: 8.8778, lng: 80.4908, type: "city" },
  { address: "Mullaitivu", lat: 9.2678, lng: 80.8142, type: "city" },
  { address: "Puthukudiyiruppu, Mullaitivu", lat: 9.3248, lng: 80.6558, type: "city" },

  // Eastern Province (Batticaloa, Ampara, Trincomalee)
  { address: "Batticaloa", lat: 7.7170, lng: 81.6985, type: "city" },
  { address: "Pasikudah, Batticaloa", lat: 7.9252, lng: 81.5606, type: "city" },
  { address: "Pasikudah Beach, Batticaloa", lat: 7.9265, lng: 81.5630, type: "beach" },
  { address: "Kalkudah, Batticaloa", lat: 7.9150, lng: 81.5540, type: "city" },
  { address: "Ampara", lat: 7.2912, lng: 81.6724, type: "city" },
  { address: "Kalmunai, Ampara", lat: 7.4170, lng: 81.8315, type: "city" },
  { address: "Akkaraipattu, Ampara", lat: 7.2163, lng: 81.8492, type: "city" },
  { address: "Pottuvil, Ampara", lat: 6.8770, lng: 81.8285, type: "city" },
  { address: "Arugam Bay, Ampara", lat: 6.8436, lng: 81.8266, type: "beach" },
  { address: "Trincomalee", lat: 8.5874, lng: 81.2152, type: "city" },
  { address: "Nilaveli, Trincomalee", lat: 8.6853, lng: 81.1969, type: "city" },
  { address: "Nilaveli Beach, Trincomalee", lat: 8.6865, lng: 81.1995, type: "beach" },
  { address: "Uppuveli, Trincomalee", lat: 8.6146, lng: 81.2104, type: "city" },
  { address: "Kinniya, Trincomalee", lat: 8.5262, lng: 81.1852, type: "city" },

  // North Western Province (Kurunegala, Puttalam)
  { address: "Kurunegala", lat: 7.4818, lng: 80.3609, type: "city" },
  { address: "Kuliyapitiya, Kurunegala", lat: 7.4682, lng: 80.0401, type: "city" },
  { address: "Narammala, Kurunegala", lat: 7.4333, lng: 80.2000, type: "city" },
  { address: "Polgahawela, Kurunegala", lat: 7.3333, lng: 80.3000, type: "city" },
  { address: "Puttalam", lat: 8.0330, lng: 79.8260, type: "city" },
  { address: "Chilaw, Puttalam", lat: 7.5759, lng: 79.7953, type: "city" },
  { address: "Wennappuwa, Puttalam", lat: 7.3242, lng: 79.8519, type: "city" },
  { address: "Kalpitiya, Puttalam", lat: 8.2323, lng: 79.7607, type: "city" },
  { address: "Wilpattu National Park", lat: 8.4414, lng: 80.0152, type: "nature" },

  // North Central Province (Anuradhapura, Polonnaruwa)
  { address: "Anuradhapura", lat: 8.3114, lng: 80.4037, type: "city" },
  { address: "Anuradhapura Sacred City", lat: 8.3510, lng: 80.3957, type: "heritage" },
  { address: "Mihintale, Anuradhapura", lat: 8.3506, lng: 80.5186, type: "heritage" },
  { address: "Kekirawa, Anuradhapura", lat: 8.0408, lng: 80.5846, type: "city" },
  { address: "Polonnaruwa", lat: 7.9403, lng: 81.0188, type: "city" },
  { address: "Polonnaruwa Ancient City", lat: 7.9431, lng: 81.0016, type: "heritage" },
  { address: "Kaduruwela, Polonnaruwa", lat: 7.9403, lng: 81.0188, type: "city" },
  { address: "Minneriya, Polonnaruwa", lat: 8.0416, lng: 80.8938, type: "city" },
  { address: "Minneriya National Park", lat: 8.0264, lng: 80.8354, type: "nature" },

  // Uva Province (Badulla, Monaragala)
  { address: "Badulla", lat: 6.9893, lng: 81.0558, type: "city" },
  { address: "Ella, Badulla", lat: 6.8711, lng: 81.0465, type: "city" },
  { address: "Ella Railway Station", lat: 6.8745, lng: 81.0483, type: "transport" },
  { address: "Ella Rock, Badulla", lat: 6.8524, lng: 81.0454, type: "nature" },
  { address: "Little Adam's Peak, Badulla", lat: 6.8643, lng: 81.0620, type: "nature" },
  { address: "Nine Arch Bridge, Badulla", lat: 6.8767, lng: 81.0608, type: "heritage" },
  { address: "Haputale, Badulla", lat: 6.7661, lng: 80.9572, type: "city" },
  { address: "Bandarawela, Badulla", lat: 6.8282, lng: 80.9880, type: "city" },
  { address: "Diyatalawa, Badulla", lat: 6.8156, lng: 80.9632, type: "city" },
  { address: "Monaragala", lat: 6.8724, lng: 81.3496, type: "city" },
  { address: "Wellawaya, Monaragala", lat: 6.7351, lng: 81.1009, type: "city" },
  { address: "Kataragama, Monaragala", lat: 6.4137, lng: 81.3325, type: "city" },
  { address: "Buttala, Monaragala", lat: 6.7578, lng: 81.2464, type: "city" },

  // Sabaragamuwa Province (Ratnapura, Kegalle)
  { address: "Ratnapura", lat: 6.6974, lng: 80.3847, type: "city" },
  { address: "Balangoda, Ratnapura", lat: 6.6493, lng: 80.7011, type: "city" },
  { address: "Embilipitiya, Ratnapura", lat: 6.3262, lng: 80.8415, type: "city" },
  { address: "Pelmadulla, Ratnapura", lat: 6.6214, lng: 80.5401, type: "city" },
  { address: "Sinharaja Forest Reserve", lat: 6.4087, lng: 80.4571, type: "nature" },
  { address: "Kegalle", lat: 7.2513, lng: 80.3461, type: "city" },
  { address: "Mawanella, Kegalle", lat: 7.2520, lng: 80.4439, type: "city" },
  { address: "Rambukkana, Kegalle", lat: 7.3275, lng: 80.3957, type: "city" },
  { address: "Pinnawala Elephant Orphanage", lat: 7.3005, lng: 80.3872, type: "nature" },
  { address: "Kitulgala, Kegalle", lat: 6.9945, lng: 80.4133, type: "nature" },
  { address: "Udawalawe National Park", lat: 6.4357, lng: 80.8872, type: "nature" }
];

export default function PlacesAutocompleteInput({ 
  label, 
  placeholder = "Search places, cities, hotels...", 
  value, 
  onChange,
  icon = <MapPin size={18} className="text-blue-500" />
}: PlacesAutocompleteInputProps) {
  
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setServiceError("Google Maps API key is missing");
      return;
    }

    setOptions({
      key: apiKey,
    });

    importLibrary("places").then(() => {
      setAutocompleteService(new google.maps.places.AutocompleteService());
      
      // Dummy element for PlacesService (it requires an HTML element)
      const dummyElement = document.createElement('div');
      setPlacesService(new google.maps.places.PlacesService(dummyElement));
    }).catch((err: any) => {
      console.error("Error loading Google Maps", err);
      setServiceError("Failed to load map services.");
    });
  }, []);

  // Sync internal query with value
  useEffect(() => {
    if (value && value.address !== query) {
      setQuery(value.address);
    } else if (!value) {
      setQuery("");
    }
  }, [value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions
  useEffect(() => {
    if (!isFocused) return;
    
    if (!query.trim()) {
      // Show default top places when empty
      setSuggestions(LOCAL_PLACES.slice(0, 8));
      setShowDropdown(true);
      return;
    }

    setLoading(true);
    setShowDropdown(true);
    
    // 1. Search local places first
    const searchLower = query.toLowerCase();
    const localMatches = LOCAL_PLACES.filter(p => 
      p.address.toLowerCase().includes(searchLower)
    ).map(p => ({
      ...p,
      source: 'local',
      description: p.address
    }));

    // 2. Fetch Google suggestions
    if (autocompleteService && query.trim().length > 1) {
      autocompleteService.getPlacePredictions({
        input: query,
        componentRestrictions: { country: "lk" },
        types: ["establishment", "geocode"]
      }, (predictions, status) => {
        setLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          const googleMatches = predictions.map(p => ({
            description: p.description,
            placeId: p.place_id,
            source: 'google'
          }));
          
          // Combine and deduplicate (rudimentary dedupe based on description)
          const combined = [...localMatches, ...googleMatches];
          const unique = Array.from(new Map(combined.map(item => [item.description, item])).values());
          
          setSuggestions(unique.slice(0, 6)); // Limit to 6 suggestions
        } else {
          setSuggestions(localMatches.slice(0, 6));
        }
      });
    } else {
      setSuggestions(localMatches.slice(0, 6));
      setLoading(false);
    }

  }, [query, isFocused, autocompleteService]);

  const handleSelect = (suggestion: any) => {
    setQuery(suggestion.description);
    setShowDropdown(false);
    
    if (suggestion.source === 'local') {
      onChange({
        address: suggestion.address,
        lat: suggestion.lat,
        lng: suggestion.lng,
        source: 'local'
      });
    } else if (suggestion.source === 'google' && placesService) {
      // Fetch details to get coordinates
      placesService.getDetails({
        placeId: suggestion.placeId,
        fields: ['geometry', 'name', 'formatted_address']
      }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          
          if (lat === 0 && lng === 0) {
             setServiceError("Invalid location coordinates returned.");
             return;
          }

          onChange({
            address: suggestion.description,
            lat: lat,
            lng: lng,
            placeId: suggestion.placeId,
            source: 'google'
          });
        } else {
           setServiceError("Failed to fetch accurate coordinates for this location.");
        }
      });
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLoading(false);
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      setQuery("My Current Location");
      setShowDropdown(false);
      onChange({
        address: "Current Location",
        lat,
        lng,
        source: 'gps'
      });
    }, () => {
      setLoading(false);
      alert("Unable to retrieve your location. Please check browser permissions.");
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (value) {
      // If user typed something and we already had a selected value, clear the valid selection
      onChange(null); 
    }
  };

  return (
    <div className="relative group w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
        {icon}
      </div>
      <input 
        ref={inputRef}
        type="text" 
        placeholder={placeholder} 
        value={query}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        className={`block w-full pl-10 pr-10 py-4 border-2 ${!value && query ? 'border-amber-300' : 'border-slate-200'} rounded-2xl focus:ring-0 focus:border-blue-500 bg-slate-50 hover:bg-white text-slate-800 font-bold transition-all shadow-inner relative z-0`}
      />
      
      {/* Loading Spinner in Input */}
      {loading && (
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none z-10">
          <Loader2 size={18} className="text-blue-500 animate-spin" />
        </div>
      )}

      {/* Clear Button */}
      {query && !loading && (
        <button 
          type="button"
          onClick={() => { setQuery(""); onChange(null); inputRef.current?.focus(); }}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      )}

      {/* Dropdown Suggestions */}
      {showDropdown && isFocused && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        >
          {serviceError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={14} />
              {serviceError}
            </div>
          )}
          
          <ul className="max-h-72 overflow-y-auto py-2">
            {!query.trim() && (
              <li 
                onClick={handleCurrentLocation}
                className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 border-b border-slate-50"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Navigation size={16} />
                </div>
                <div className="text-sm font-bold text-blue-700">Use my current location</div>
              </li>
            )}
            
            {suggestions.length === 0 && !loading && query.trim() && (
              <li className="px-4 py-8 text-center text-slate-500 text-sm">
                No places found. Check your spelling.
              </li>
            )}
            
            {suggestions.map((s, i) => (
              <li 
                key={i} 
                onClick={() => handleSelect(s)}
                className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 group transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                  <MapPin size={16} />
                </div>
                <div className="text-sm font-medium text-slate-700 truncate w-full">
                  {/* Highlight matching text if needed, for now just text */}
                  {s.description}
                  {s.type && <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize">{s.type}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
