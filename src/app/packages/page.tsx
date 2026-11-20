import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import Link from "next/link";
import { MapPin, Calendar, ArrowRight, Package as PackageIcon, Users, Sparkles, Search } from "lucide-react";
import PackageImage from "@/components/packages/PackageImage";

export const dynamic = "force-dynamic";

export default async function PublicPackagesDirectory({
  searchParams
}: {
  searchParams?: Promise<{ category?: string; q?: string }>;
}) {
  await dbConnect();
  
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedCategory = resolvedParams.category;
  const searchQuery = resolvedParams.q;

  const query: any = { status: "PUBLISHED" };
  if (selectedCategory && selectedCategory !== "ALL") {
    query.category = selectedCategory;
  }
  if (searchQuery) {
    query.$or = [
      { title: { $regex: searchQuery, $options: "i" } },
      { shortDescription: { $regex: searchQuery, $options: "i" } },
      { startingCity: { $regex: searchQuery, $options: "i" } },
      { destinations: { $in: [new RegExp(searchQuery, "i")] } }
    ];
  }

  // Only published packages are visible to the public
  const packages = await Package.find(query).sort({ createdAt: -1 }).lean();

  const CATEGORIES = [
    "ALL",
    "Cultural Tour",
    "Wildlife Safari",
    "Beach Tour",
    "Hill Country & Tea",
    "Adventure & Trekking",
    "Island Round Tour"
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-16 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-blue-700 font-extrabold mb-4 bg-blue-100/70 border border-blue-200 px-4 py-2 rounded-full text-xs uppercase tracking-wider">
            <Sparkles size={16} className="text-blue-600" />
            <span>Curated Sri Lanka Journeys</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
            Explore Sri Lanka with Expert Drivers
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto text-base md:text-lg">
            Browse verified custom itineraries created by professional local drivers. Fully customizable, transparent pricing, and instant booking.
          </p>
        </div>

        {/* Category Pills & Search */}
        <div className="mb-10 space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIES.map(cat => {
              const isSelected = (!selectedCategory && cat === "ALL") || selectedCategory === cat;
              return (
                <Link
                  key={cat}
                  href={cat === "ALL" ? "/packages" : `/packages?category=${encodeURIComponent(cat)}`}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {cat === "ALL" ? "All Tours" : cat}
                </Link>
              );
            })}
          </div>
        </div>

        {packages.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-xs max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
              <PackageIcon size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Packages Found</h3>
            <p className="text-slate-500 text-sm mb-6">
              No published packages match the selected criteria. Check back soon or explore other categories.
            </p>
            <Link
              href="/packages"
              className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-colors"
            >
              Reset Filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {packages.map((pkg: any) => {
              const currency = pkg.costs?.currency || "LKR";
              const price = pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || pkg.price || 0;
              const pricingBasis = pkg.costs?.priceType
                ? pkg.costs.priceType === "PER_PERSON"
                  ? "per person"
                  : pkg.costs.priceType === "PER_VEHICLE"
                  ? "per vehicle"
                  : "entire package"
                : "per vehicle";

              return (
                <div
                  key={pkg._id.toString()}
                  className="bg-white rounded-3xl shadow-sm hover:shadow-xl transition-all border border-slate-200/80 overflow-hidden flex flex-col group"
                >
                  <div className="relative h-60 w-full overflow-hidden bg-slate-100">
                    <PackageImage
                      src={pkg.coverPhoto}
                      alt={pkg.title}
                      category={pkg.category}
                    />
                    <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
                      {pkg.category}
                    </div>
                  </div>

                  <div className="p-7 flex flex-col flex-1">
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {pkg.title}
                    </h3>
                    <p className="text-slate-600 text-sm mb-6 line-clamp-2 leading-relaxed">
                      {pkg.shortDescription}
                    </p>

                    {pkg.destinations && pkg.destinations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-6">
                        {pkg.destinations.slice(0, 3).map((d: string) => (
                          <span key={d} className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold flex items-center gap-1">
                            <MapPin size={11} /> {d}
                          </span>
                        ))}
                        {pkg.destinations.length > 3 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold">
                            +{pkg.destinations.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-6 text-xs font-bold text-slate-500 mb-6 mt-auto">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={15} className="text-blue-500" />
                        {pkg.days} Days / {pkg.nights ?? Math.max(0, pkg.days - 1)} Nights
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={15} className="text-blue-500" />
                        {pkg.startingCity}
                      </span>
                      {pkg.maxPassengers && (
                        <span className="flex items-center gap-1.5">
                          <Users size={15} className="text-blue-500" />
                          Up to {pkg.maxPassengers}
                        </span>
                      )}
                    </div>
                    
                    <div className="pt-5 border-t border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Starting From</p>
                        <p className="font-black text-slate-900 text-xl">
                          {currency} {price.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium capitalize">{pricingBasis}</p>
                      </div>
                      <Link
                        href={`/packages/${pkg._id.toString()}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs hover:shadow flex items-center gap-1.5"
                      >
                        View Tour <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
