import Link from "next/link";
import { Plane, Globe, MessageCircle, Send, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                <Plane size={20} />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">
                Lanka Airport <span className="text-blue-500">Ride</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 mb-6">
              Reliable, comfortable, and safe airport transfers across beautiful Sri Lanka. Your journey begins with us.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><Globe size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><MessageCircle size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><Send size={20} /></a>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4 text-lg">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-blue-400 transition-colors">Home</Link></li>
              <li><Link href="/about" className="hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link href="/vehicles" className="hover:text-blue-400 transition-colors">Our Fleet</Link></li>
              <li><Link href="/destinations" className="hover:text-blue-400 transition-colors">Destinations</Link></li>
              <li><Link href="/contact" className="hover:text-blue-400 transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 text-lg">Services</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/booking" className="hover:text-blue-400 transition-colors">Airport Pickup</Link></li>
              <li><Link href="/booking" className="hover:text-blue-400 transition-colors">Airport Drop-off</Link></li>
              <li><Link href="/booking" className="hover:text-blue-400 transition-colors">City Transfers</Link></li>
              <li><Link href="/booking" className="hover:text-blue-400 transition-colors">Tour Packages</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 text-lg">Contact Info</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <span>123 Airport Road, Katunayake, Sri Lanka</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-blue-500 flex-shrink-0" />
                <span>+94 77 123 4567</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-blue-500 flex-shrink-0" />
                <span>bookings@lankaairportride.com</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Lanka Airport Ride. All rights reserved.</p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
