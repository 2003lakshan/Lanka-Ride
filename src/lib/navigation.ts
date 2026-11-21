/**
 * Navigation helpers for At Your Service – Powered by Pexora.
 * Builds standard Google Maps directions URLs without a Google API key or paid routing services.
 */

export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return false;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // (0,0) is Null Island (often empty coordinate placeholders)
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Builds Google Maps URL using URLSearchParams:
 * https://www.google.com/maps/dir/?api=1&destination=LATITUDE,LONGITUDE&travelmode=driving&dir_action=navigate
 * Origin is omitted so device GPS / current location is used by Google Maps.
 */
export function buildGoogleMapsNavigationUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
    travelmode: "driving",
    dir_action: "navigate"
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export type NavigationStepType = "PICKUP" | "STOP" | "OVERNIGHT" | "DROPOFF" | "FINISHED";

export interface DriverTripNavigationTarget {
  name: string;
  lat?: number;
  lng?: number;
  stepType: NavigationStepType;
  stepLabel: string;
  dayNumber?: number;
  dayIndex?: number;
  stopIndex?: number;
  isCoordinateValid: boolean;
  googleMapsUrl?: string;
  isAllCompleted?: boolean;
  notes?: string;
  totalStops?: number;
  completedStops?: number;
}

export function getDriverTripNavigationTarget(booking: any): DriverTripNavigationTarget {
  if (!booking) {
    return {
      name: "No Booking",
      stepType: "FINISHED",
      stepLabel: "No Active Booking",
      isCoordinateValid: false,
      isAllCompleted: true
    };
  }

  const status = booking.status || "PENDING";

  // 1. Check if booking is terminal
  if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(status)) {
    return {
      name: status === "COMPLETED" ? "Trip Completed" : `Trip ${status}`,
      stepType: "FINISHED",
      stepLabel: status === "COMPLETED" ? "Trip Completed" : `Trip ${status}`,
      isCoordinateValid: false,
      isAllCompleted: true
    };
  }

  // 2. Before Passenger Pickup
  // Any status prior to pickup: e.g. CONFIRMED, DRIVER_ASSIGNED, DRIVER_EN_ROUTE, DRIVER_ARRIVED, PENDING
  const isPickedUp = ["PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"].includes(status);

  if (!isPickedUp) {
    const airport = booking.airportId;
    const pickupLat = booking.pickupLat || airport?.lat;
    const pickupLng = booking.pickupLng || airport?.lng;
    const pickupName = booking.pickupAddress || airport?.name || "Passenger Pickup Location";
    const valid = isValidCoordinate(pickupLat, pickupLng);

    const instructions = booking.pickupInstructions || booking.pickMeDetails?.pickupInstructions;
    return {
      name: pickupName,
      lat: pickupLat,
      lng: pickupLng,
      stepType: "PICKUP",
      stepLabel: "Passenger Pickup",
      notes: instructions || undefined,
      isCoordinateValid: valid,
      googleMapsUrl: valid ? buildGoogleMapsNavigationUrl(pickupLat, pickupLng) : undefined
    };
  }

  // 3. After Pickup
  const isCustomTrip = Boolean(
    booking.customTripDetails?.isCustomTrip &&
    Array.isArray(booking.customTripDetails?.itinerary) &&
    booking.customTripDetails.itinerary.length > 0
  );

  // If Custom Trip with Itinerary:
  if (isCustomTrip) {
    const itinerary = booking.customTripDetails.itinerary;
    let totalStopsCount = 0;
    let completedStopsCount = 0;

    // Count overall progress
    for (const day of itinerary) {
      if (Array.isArray(day.placesToVisit)) {
        for (const place of day.placesToVisit) {
          totalStopsCount++;
          if (place.visited) completedStopsCount++;
        }
      }
      if (day.overnightLocation && (day.overnightLocation.lat || day.overnightLocation.hotel || day.overnightLocation.city)) {
        totalStopsCount++;
        if (day.overnightLocation.visited) completedStopsCount++;
      }
    }
    // Also dropoff if specified
    const dropoffLoc = booking.customTripDetails?.dropoffLocation;
    if (dropoffLoc && (dropoffLoc.lat || dropoffLoc.address)) {
      totalStopsCount++;
      if (dropoffLoc.visited) completedStopsCount++;
    }

    // Traverse each day in saved order
    for (let d = 0; d < itinerary.length; d++) {
      const day = itinerary[d];
      const isLastDay = d === itinerary.length - 1;

      // Check unvisited places of this day
      if (Array.isArray(day.placesToVisit)) {
        for (let s = 0; s < day.placesToVisit.length; s++) {
          const place = day.placesToVisit[s];
          if (!place.visited) {
            const valid = isValidCoordinate(place.lat, place.lng);
            const stopName = place.name || `Day ${day.dayNumber} Stop ${s + 1}`;
            return {
              name: stopName,
              lat: place.lat,
              lng: place.lng,
              stepType: "STOP",
              stepLabel: `Day ${day.dayNumber} • Stop ${s + 1}`,
              dayNumber: day.dayNumber,
              dayIndex: d,
              stopIndex: s,
              notes: place.activityTime ? `Activity time: ${place.activityTime}` : undefined,
              isCoordinateValid: valid,
              googleMapsUrl: valid ? buildGoogleMapsNavigationUrl(place.lat, place.lng) : undefined,
              totalStops: totalStopsCount,
              completedStops: completedStopsCount
            };
          }
        }
      }

      // After last visit of this day: navigate to overnight location or final drop-off
      const overnight = day.overnightLocation;
      const hasOvernight = Boolean(overnight && (overnight.lat || overnight.hotel || overnight.city));

      if (!isLastDay) {
        if (hasOvernight && !overnight.visited) {
          const valid = isValidCoordinate(overnight.lat, overnight.lng);
          const overnightName = overnight.hotel 
            ? `${overnight.hotel}${overnight.city ? `, ${overnight.city}` : ""}`
            : (overnight.city || `Day ${day.dayNumber} Overnight Stay`);
          return {
            name: overnightName,
            lat: overnight.lat,
            lng: overnight.lng,
            stepType: "OVERNIGHT",
            stepLabel: `Day ${day.dayNumber} Overnight Location`,
            dayNumber: day.dayNumber,
            dayIndex: d,
            isCoordinateValid: valid,
            googleMapsUrl: valid ? buildGoogleMapsNavigationUrl(overnight.lat, overnight.lng) : undefined,
            totalStops: totalStopsCount,
            completedStops: completedStopsCount
          };
        }
      } else {
        // Last Day: check if overnight is specified and unvisited first
        if (hasOvernight && !overnight.visited) {
          const valid = isValidCoordinate(overnight.lat, overnight.lng);
          const overnightName = overnight.hotel 
            ? `${overnight.hotel}${overnight.city ? `, ${overnight.city}` : ""}`
            : (overnight.city || `Final Day Overnight Stay`);
          return {
            name: overnightName,
            lat: overnight.lat,
            lng: overnight.lng,
            stepType: "OVERNIGHT",
            stepLabel: `Final Day Overnight Location`,
            dayNumber: day.dayNumber,
            dayIndex: d,
            isCoordinateValid: valid,
            googleMapsUrl: valid ? buildGoogleMapsNavigationUrl(overnight.lat, overnight.lng) : undefined,
            totalStops: totalStopsCount,
            completedStops: completedStopsCount
          };
        }

        // Navigate to final drop-off
        const dropoffLat = dropoffLoc?.lat || booking.destinationLat;
        const dropoffLng = dropoffLoc?.lng || booking.destinationLng;
        const dropoffAddress = dropoffLoc?.address || booking.destinationAddress || "Final Drop-off Location";
        const dropoffVisited = dropoffLoc?.visited;

        if (!dropoffVisited) {
          const valid = isValidCoordinate(dropoffLat, dropoffLng);
          return {
            name: dropoffAddress,
            lat: dropoffLat,
            lng: dropoffLng,
            stepType: "DROPOFF",
            stepLabel: "Final Drop-off Destination",
            dayNumber: day.dayNumber,
            dayIndex: d,
            isCoordinateValid: valid,
            googleMapsUrl: valid ? buildGoogleMapsNavigationUrl(dropoffLat, dropoffLng) : undefined,
            totalStops: totalStopsCount,
            completedStops: completedStopsCount
          };
        }
      }
    }

    // All itinerary stops, overnights, and drop-off visited
    return {
      name: "All Itinerary Stops Completed",
      stepType: "FINISHED",
      stepLabel: "All Itinerary Stops Visited",
      isCoordinateValid: false,
      isAllCompleted: true,
      totalStops: totalStopsCount,
      completedStops: completedStopsCount
    };
  }

  // Check if trip contains intermediate stops (Local Ride with intermediate stops)
  const stops = Array.isArray(booking.intermediateStops)
    ? booking.intermediateStops
    : Array.isArray(booking.pickMeDetails?.intermediateStops)
    ? booking.pickMeDetails.intermediateStops
    : [];

  if (stops.length > 0) {
    const totalStops = stops.length + 1; // stops + dropoff
    let completedStops = 0;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      if (stop.visited) {
        completedStops++;
      } else {
        const valid = isValidCoordinate(stop.lat, stop.lng);
        const stopName = stop.name ? `${stop.name} (${stop.address})` : stop.address;
        return {
          name: stopName,
          lat: stop.lat,
          lng: stop.lng,
          stepType: "STOP",
          stepLabel: `Stop ${stop.stopOrder || i + 1} of ${stops.length}`,
          stopIndex: i,
          notes: stop.notes || undefined,
          isCoordinateValid: valid,
          googleMapsUrl: valid ? buildGoogleMapsNavigationUrl(stop.lat, stop.lng) : undefined,
          totalStops,
          completedStops
        };
      }
    }
  }

  // Standard (Point-to-Point) Trip after pickup:
  const destLat = booking.destinationLat;
  const destLng = booking.destinationLng;
  const destName = booking.destinationAddress || "Drop-off Destination";
  const valid = isValidCoordinate(destLat, destLng);

  return {
    name: destName,
    lat: destLat,
    lng: destLng,
    stepType: "DROPOFF",
    stepLabel: "Drop-off Destination",
    isCoordinateValid: valid,
    googleMapsUrl: valid ? buildGoogleMapsNavigationUrl(destLat, destLng) : undefined,
    totalStops: stops.length > 0 ? stops.length + 1 : undefined,
    completedStops: stops.length > 0 ? stops.length : undefined
  };
}
