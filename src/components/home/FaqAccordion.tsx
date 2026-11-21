"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
  category?: string;
}

const FAQS: FaqItem[] = [
  {
    question: "How do airport pickups work at Bandaranaike International Airport (CMB)?",
    answer: "Your assigned driver monitors your flight number for any delays or early arrivals. Upon landing and clearing customs, your driver greets you inside the arrivals hall holding a sign with your name. They assist with your luggage and guide you directly to your air-conditioned vehicle.",
    category: "Airport Transfers"
  },
  {
    question: "Can I plan a custom multi-day itinerary across Sri Lanka?",
    answer: "Yes! Our Custom Trip Builder allows you to plan personalized multi-day journeys day by day. You can select your starting city, overnight destinations, preferred vehicle category (Car, KDH Van, SUV), and special requests like child seats. Verified drivers review your plan and provide customized offers.",
    category: "Custom Trips"
  },
  {
    question: "How are drivers verified on the platform?",
    answer: "Every driver must complete a rigorous registration process including submission of their National Identity Card (NIC) or Passport, commercial driving licence, vehicle revenue license, insurance policies, and vehicle inspection details. All submissions are manually vetted and approved by our operations team before any driver can accept bookings.",
    category: "Safety & Drivers"
  },
  {
    question: "How does live trip tracking and the shareable link work?",
    answer: "Once your driver is en route or your trip commences, you can monitor the vehicle's real-time GPS position on our interactive map. You can also generate a secure, private shareable tracking link to send to family or friends via WhatsApp or email. They can view live trip progress in any browser without needing to create an account.",
    category: "Tracking"
  },
  {
    question: "What is included in the curated Tour Packages?",
    answer: "Tour packages are designed by verified local chauffeurs and clearly specify what is covered — including vehicle, professional driver-guide, fuel, toll fees, and specified amenities (such as bottled water or Wi-Fi). Each package detail page provides a transparent breakdown of daily itineraries, inclusions, exclusions, and vehicle specifications.",
    category: "Tour Packages"
  },
  {
    question: "How can I get immediate assistance with my booking?",
    answer: "Our operations team is reachable 24/7 via WhatsApp Business click-to-chat. You can tap the WhatsApp support button anywhere on the platform to start a direct conversation with our team, or submit an inquiry through our Contact page.",
    category: "Support"
  }
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(prev => (prev === index ? null : index));
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {FAQS.map((faq, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const headerId = `faq-header-${index}`;

        return (
          <div
            key={index}
            className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
              isOpen
                ? "bg-white border-[#2563EB]/40 shadow-md ring-1 ring-[#2563EB]/20"
                : "bg-white/80 hover:bg-white border-slate-200 shadow-xs"
            }`}
          >
            <button
              type="button"
              id={headerId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(index)}
              className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] rounded-2xl"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0">
                  {index + 1}
                </span>
                <span className="font-bold text-slate-900 text-base sm:text-lg leading-snug">
                  {faq.question}
                </span>
              </div>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200 shrink-0 ${
                  isOpen ? "rotate-180 bg-[#102A43] text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <ChevronDown size={18} />
              </div>
            </button>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={headerId}
                className="px-6 pb-6 pt-1 text-slate-600 text-sm sm:text-base leading-relaxed border-t border-slate-100 animate-in fade-in-50 duration-200"
              >
                <p>{faq.answer}</p>
                {faq.category && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                    <HelpCircle size={13} className="text-[#2563EB]" />
                    <span>{faq.category}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

