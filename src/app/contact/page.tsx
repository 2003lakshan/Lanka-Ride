"use client";

import { Mail, Phone, MapPin, Send, MessageSquare } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-16">
      {/* Hero Section */}
      <div className="bg-slate-900 text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20">
           <img 
              src="/images/sri_lanka_hero.jpg" 
              alt="Sri Lanka Background" 
              className="w-full h-full object-cover"
           />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">Get in Touch</h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto font-medium">
            Have questions about your upcoming airport transfer? Our support team is here to help you 24/7.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Contact Information Cards */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex items-start gap-4 transform transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Phone size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Call Us (24/7)</h3>
                <p className="text-slate-500 text-sm mb-2">Immediate assistance for urgent bookings or trackings.</p>
                <a href="tel:+94771234567" className="text-blue-600 font-bold text-lg hover:text-blue-800 transition-colors">+94 77 123 4567</a>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex items-start gap-4 transform transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">WhatsApp</h3>
                <p className="text-slate-500 text-sm mb-2">Message us for quick queries and support.</p>
                <a href="https://wa.me/94771234567" target="_blank" rel="noopener noreferrer" className="text-green-600 font-bold text-lg hover:text-green-800 transition-colors">+94 77 123 4567</a>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex items-start gap-4 transform transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shrink-0">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Email Us</h3>
                <p className="text-slate-500 text-sm mb-2">For general inquiries and partnership requests.</p>
                <a href="mailto:support@lankaairportride.com" className="text-purple-600 font-bold text-sm hover:text-purple-800 transition-colors">support@lankaairportride.com</a>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 h-full">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-6 tracking-tight">Send us a message</h2>
              
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert("Message sent successfully! We will get back to you shortly."); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Your Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="John Doe"
                      className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                    <input 
                      type="email" 
                      required
                      placeholder="john@example.com"
                      className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Subject</label>
                  <input 
                    type="text" 
                    required
                    placeholder="How can we help you?"
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Message</label>
                  <textarea 
                    rows={5} 
                    required
                    placeholder="Write your message here..."
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800 resize-none"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 w-full md:w-auto transform hover:-translate-y-1"
                >
                  <Send size={20} />
                  Send Message
                </button>
              </form>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
