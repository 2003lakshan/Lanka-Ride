import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Popular Sri Lanka locations fallback dictionary
const SRI_LANKA_FALLBACKS: Record<string, { lat: number; lng: number; address: string }> = {
  "colombo": { lat: 6.9271, lng: 79.8612, address: "Colombo, Western Province" },
  "fort": { lat: 6.9344, lng: 79.8428, address: "Colombo Fort, Colombo 01" },
  "kollupitiya": { lat: 6.9034, lng: 79.8524, address: "Kollupitiya, Colombo 03" },
  "bambalapitiya": { lat: 6.8905, lng: 79.8569, address: "Bambalapitiya, Colombo 04" },
  "havelock": { lat: 6.8778, lng: 79.8667, address: "Havelock Town, Colombo 05" },
  "wellawatte": { lat: 6.8722, lng: 79.8611, address: "Wellawatte, Colombo 06" },
  "dehiwala": { lat: 6.8517, lng: 79.8656, address: "Dehiwala, Western Province" },
  "mount lavinia": { lat: 6.8344, lng: 79.8644, address: "Mount Lavinia, Western Province" },
  "moratuwa": { lat: 6.7730, lng: 79.8816, address: "Moratuwa, Western Province" },
  "panadura": { lat: 6.7133, lng: 79.9075, address: "Panadura, Western Province" },
  "kalutara": { lat: 6.5854, lng: 79.9607, address: "Kalutara, Western Province" },
  "kaduwela": { lat: 6.9333, lng: 79.9833, address: "Kaduwela, Western Province" },
  "battaramulla": { lat: 6.8997, lng: 79.9197, address: "Battaramulla, Western Province" },
  "rajagiriya": { lat: 6.9089, lng: 79.8944, address: "Rajagiriya, Western Province" },
  "nugegoda": { lat: 6.8700, lng: 79.8970, address: "Nugegoda, Western Province" },
  "maharagama": { lat: 6.8480, lng: 79.9267, address: "Maharagama, Western Province" },
  "kotte": { lat: 6.8917, lng: 79.9000, address: "Sri Jayawardenepura Kotte" },
  "negombo": { lat: 7.2083, lng: 79.8358, address: "Negombo, Western Province" },
  "katunayake": { lat: 7.1693, lng: 79.8886, address: "Katunayake, Western Province" },
  "airport": { lat: 7.1804, lng: 79.8833, address: "Bandaranaike International Airport (CMB)" },
  "kandy": { lat: 7.2906, lng: 80.6337, address: "Kandy, Central Province" },
  "peradeniya": { lat: 7.2600, lng: 80.5960, address: "Peradeniya, Central Province" },
  "galle": { lat: 6.0535, lng: 80.2210, address: "Galle Fort & City, Southern Province" },
  "hikkaduwa": { lat: 6.1395, lng: 80.1063, address: "Hikkaduwa, Southern Province" },
  "unawatuna": { lat: 6.0100, lng: 80.2490, address: "Unawatuna, Southern Province" },
  "mirissa": { lat: 5.9483, lng: 80.4552, address: "Mirissa, Southern Province" },
  "weligama": { lat: 5.9722, lng: 80.4289, address: "Weligama, Southern Province" },
  "matara": { lat: 5.9549, lng: 80.5550, address: "Matara, Southern Province" },
  "tangalle": { lat: 6.0242, lng: 80.7941, address: "Tangalle, Southern Province" },
  "ella": { lat: 6.8667, lng: 81.0466, address: "Ella, Uva Province" },
  "nuwara eliya": { lat: 6.9497, lng: 80.7891, address: "Nuwara Eliya, Central Province" },
  "sigiriya": { lat: 7.9570, lng: 80.7603, address: "Sigiriya, Central Province" },
  "dambulla": { lat: 7.8742, lng: 80.6511, address: "Dambulla, Central Province" },
  "jaffna": { lat: 9.6615, lng: 80.0255, address: "Jaffna, Northern Province" },
  "trincomalee": { lat: 8.5874, lng: 81.2152, address: "Trincomalee, Eastern Province" },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const q = query.trim().toLowerCase();

    // 1. Check local fallback matches
    const localMatches: Array<{ address: string; lat: number; lng: number }> = [];
    for (const [key, val] of Object.entries(SRI_LANKA_FALLBACKS)) {
      if (key.includes(q) || q.includes(key) || val.address.toLowerCase().includes(q)) {
        localMatches.push(val);
      }
    }

    // 2. Try Nominatim OpenStreetMap for real-time Sri Lanka geocoding
    let osmResults: Array<{ address: string; lat: number; lng: number }> = [];
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query + ", Sri Lanka"
      )}&countrycodes=lk&limit=5&addressdetails=1`;

      const res = await fetch(osmUrl, {
        headers: {
          "User-Agent": "LankaAirportRide-PickMe/1.0",
        },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        osmResults = (data || []).map((item: any) => ({
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
      }
    } catch {
      // Nominatim failed or timed out, continue with local matches
    }

    // Merge and deduplicate
    const combined = [...localMatches, ...osmResults];
    const unique = combined.filter(
      (item, index, self) =>
        index === self.findIndex((t) => Math.abs(t.lat - item.lat) < 0.001 && Math.abs(t.lng - item.lng) < 0.001)
    );

    return NextResponse.json({ results: unique.slice(0, 8) });
  } catch (error: any) {
    console.error("Geocoding error:", error);
    return NextResponse.json({ results: [] });
  }
}
