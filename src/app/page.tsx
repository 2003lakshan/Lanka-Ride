import Link from "next/link";
import { ArrowRight, MapPin, Calendar, Clock, ShieldCheck, ThumbsUp, CreditCard, Phone, Mail, MessageSquare, Package } from "lucide-react";
import Image from "next/image";
import dbConnect from "@/lib/mongodb";
import PackageModel from "@/models/Package";

export const dynamic = 'force-dynamic';

export default async function Home() {
  await dbConnect();
  const publishedPackages = await PackageModel.find({ status: 'PUBLISHED' }).sort({ createdAt: -1 }).limit(4).lean();

  return (
    <div className="flex flex-col min-h-screen">
      <section className="relative min-h-[600px] md:min-h-[700px] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <Image 
            src="/images/hero.jpg" 
            alt="Beautiful Sri Lanka landscape at sunset with a train on a viaduct bridge" 
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/60 to-slate-900/10"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12 pt-16 pb-20">
          
          {/* Left Text */}
          <div className="flex-1 text-center md:text-left text-white mt-10 md:mt-0 max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 tracking-tight text-white drop-shadow-lg">
              Your Journey <br className="hidden md:block" />
              Starts at the <span className="text-blue-400">Airport</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-100 mb-10 max-w-xl drop-shadow-md font-medium leading-relaxed">
              Book reliable, comfortable, and affordable airport transfers across Sri Lanka. Instant fare estimates and secure online bookings for tourists.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="#search" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3">
                Book Your Ride <ArrowRight size={20} />
              </Link>
              <Link href="/vehicles" className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center shadow-lg">
                View Fleet
              </Link>
            </div>
          </div>

          {/* Right Search Box */}
          <div id="search" className="flex-1 w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 transform md:translate-y-6 border border-white/20">
            <h2 className="text-2xl font-extrabold text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-8 h-1 bg-blue-600 rounded-full block"></span>
              Where to?
            </h2>
            <form className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Pickup Location</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <MapPin size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <select className="block w-full pl-10 pr-10 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-blue-500 bg-slate-50 hover:bg-white text-slate-700 font-medium transition-all appearance-none cursor-pointer">
                    <option>Bandaranaike International Airport (CMB)</option>
                    <option>Mattala Rajapaksa International (HRI)</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Destination</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <MapPin size={18} className="text-blue-500" />
                  </div>
                  <input type="text" placeholder="e.g. Kandy, Galle, Ella..." className="block w-full pl-10 pr-3.5 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-blue-500 bg-slate-50 hover:bg-white text-slate-800 font-medium transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Date</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Calendar size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input type="date" className="block w-full pl-10 pr-3.5 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-blue-500 bg-slate-50 hover:bg-white text-slate-800 font-medium transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Time</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Clock size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input type="time" className="block w-full pl-10 pr-3.5 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-blue-500 bg-slate-50 hover:bg-white text-slate-800 font-medium transition-all" />
                  </div>
                </div>
              </div>

              <Link href="/booking" className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-lg transition-all flex justify-center items-center shadow-lg shadow-slate-900/20 group">
                Search Vehicles <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </form>
          </div>
          
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Choose Us?</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">We provide the most reliable and comfortable airport transfer experience for tourists visiting Sri Lanka.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="bg-blue-100 p-4 rounded-full mb-6 text-blue-600">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Safe & Reliable</h3>
              <p className="text-slate-600">All our drivers are verified professionals with years of experience driving across Sri Lanka.</p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="bg-blue-100 p-4 rounded-full mb-6 text-blue-600">
                <CreditCard size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Transparent Pricing</h3>
              <p className="text-slate-600">Know exactly what you'll pay before you book. No hidden fees, no surge pricing surprises.</p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="bg-blue-100 p-4 rounded-full mb-6 text-blue-600">
                <ThumbsUp size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Comfort Guaranteed</h3>
              <p className="text-slate-600">Modern, air-conditioned vehicles cleaned before every trip for your ultimate comfort.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Popular Destinations</h2>
              <p className="text-slate-600 max-w-2xl">Discover Sri Lanka's most beautiful spots right from the airport.</p>
            </div>
            <Link href="/destinations" className="hidden md:flex text-blue-600 hover:text-blue-700 font-semibold items-center gap-1">
              View all <ArrowRight size={16} />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "Kandy", desc: "Cultural Capital", img: "/images/kandy.jpg" },
              { name: "Galle", desc: "Historic Fort City", img: "/images/galle.jpg" },
              { name: "Ella", desc: "Scenic Hill Country", img: "/images/ella.jpg" },
              { name: "Mirissa", desc: "Pristine Beaches", img: "/images/mirissa.jpg" }
            ].map((dest, i) => (
              <div key={i} className="group relative rounded-3xl overflow-hidden cursor-pointer aspect-[4/5] shadow-lg hover:shadow-2xl transition-all duration-500">
                <Image 
                  src={dest.img} 
                  alt={dest.name} 
                  fill 
                  className="object-cover group-hover:scale-110 transition-transform duration-700" 
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full transform group-hover:-translate-y-2 transition-transform duration-500">
                  <h3 className="text-2xl font-extrabold text-white mb-2">{dest.name}</h3>
                  <p className="text-blue-200 font-medium text-sm flex items-center gap-2">
                    <MapPin size={14} /> {dest.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore Travel Packages */}
      {publishedPackages.length > 0 && (
        <section className="py-20 bg-slate-50 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-12">
              <div>
                <div className="flex items-center gap-2 text-blue-600 font-bold mb-2">
                   <Package size={20} />
                   <span>NEW FEATURE</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Explore Travel Packages</h2>
                <p className="text-slate-600 max-w-2xl">Custom itineraries curated and driven by our verified professional drivers.</p>
              </div>
              <Link href="/packages" className="hidden md:flex text-blue-600 hover:text-blue-700 font-semibold items-center gap-1">
                View all packages <ArrowRight size={16} />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {publishedPackages.map((pkg: any) => (
                <div key={pkg._id.toString()} className="bg-white rounded-3xl shadow-md hover:shadow-xl transition-all border border-slate-100 overflow-hidden flex flex-col group">
                  <div className="relative h-48 w-full overflow-hidden">
                    <img src={pkg.coverPhoto} alt={pkg.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
                      {pkg.category}
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-700 transition-colors">{pkg.title}</h3>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{pkg.shortDescription}</p>
                    
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-4 mt-auto">
                      <span className="flex items-center gap-1"><Calendar size={14} className="text-slate-400"/> {pkg.days} Days</span>
                      <span className="flex items-center gap-1"><MapPin size={14} className="text-slate-400"/> {pkg.startingCity}</span>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">From</p>
                        <p className="font-black text-slate-900 text-lg">LKR {pkg.costs?.totalStartingPrice?.toLocaleString()}</p>
                      </div>
                      <Link href={`/packages/${pkg._id}`} className="bg-slate-100 hover:bg-slate-200 text-blue-700 w-10 h-10 rounded-xl flex items-center justify-center transition-colors">
                        <ArrowRight size={18} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* Contact CTA Section */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-3xl overflow-hidden shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-10 md:p-16 flex flex-col justify-center">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Need help planning your journey?</h2>
                <p className="text-blue-100 text-lg mb-8 max-w-md">Our support team is available 24/7 to assist you with special requests, custom tours, and any questions.</p>
                
                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-4 text-white">
                    <div className="w-12 h-12 bg-blue-800/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Phone size={20} className="text-blue-300" />
                    </div>
                    <div>
                      <div className="text-sm text-blue-200 font-medium">Call Us (24/7)</div>
                      <div className="font-bold text-lg">+94 77 123 4567</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-white">
                    <div className="w-12 h-12 bg-blue-800/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <MessageSquare size={20} className="text-green-300" />
                    </div>
                    <div>
                      <div className="text-sm text-blue-200 font-medium">WhatsApp Support</div>
                      <div className="font-bold text-lg">+94 77 123 4567</div>
                    </div>
                  </div>
                </div>

                <div>
                  <Link href="/contact" className="inline-flex bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-blue-600/30 items-center gap-2">
                    Send us a Message <ArrowRight size={20} />
                  </Link>
                </div>
              </div>
              <div className="relative hidden lg:block bg-slate-800 min-h-[400px]">
                <Image 
                  src="/images/galle.jpg" 
                  alt="Customer support"
                  fill
                  className="object-cover opacity-80 mix-blend-overlay"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
