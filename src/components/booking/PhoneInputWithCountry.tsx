"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { COUNTRIES, Country, parsePhoneNumber, formatPhoneNumber } from "@/lib/countries";
import { ChevronDown, Search, Check, Phone } from "lucide-react";

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (fullPhone: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: boolean;
  id?: string;
}

export default function PhoneInputWithCountry({
  value,
  onChange,
  disabled = false,
  placeholder = "77 123 4567",
  error = false,
  id,
}: PhoneInputWithCountryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse dial code and national number from incoming value
  const parsed = useMemo(() => {
    return parsePhoneNumber(value);
  }, [value]);

  const selectedCountry = useMemo(() => {
    return COUNTRIES.find((c) => c.dialCode === parsed.dialCode) || COUNTRIES[0];
  }, [parsed.dialCode]);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase().trim();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleDialCodeSelect = (country: Country) => {
    setIsOpen(false);
    setSearch("");
    const combined = formatPhoneNumber(country.dialCode, parsed.nationalNumber);
    onChange(combined);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d\s-]/g, "");
    const combined = formatPhoneNumber(parsed.dialCode, raw);
    onChange(combined);
  };

  return (
    <div className="relative w-full flex items-center" ref={popoverRef}>
      {/* Country Code Trigger */}
      <div className="relative shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 h-[48px] px-3 bg-slate-50 border border-r-0 rounded-l-xl text-xs font-bold text-slate-800 transition-colors outline-none cursor-pointer ${
            error
              ? "border-red-300 bg-red-50/30"
              : isOpen
              ? "border-blue-500 bg-white"
              : "border-slate-200 hover:bg-slate-100"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          title="Select Country Code"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="text-base shrink-0">{selectedCountry.flag}</span>
          <span>{selectedCountry.dialCode}</span>
          <ChevronDown
            size={13}
            className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Popover Dropdown */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="p-2 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code or country..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 p-1" role="listbox">
              {filteredCountries.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">No matching country code</div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = c.dialCode === selectedCountry.dialCode;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleDialCodeSelect(c)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 text-blue-900 font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base shrink-0">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="font-mono text-slate-500 shrink-0 ml-2">{c.dialCode}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* National Phone Number Input */}
      <div className="relative flex-1">
        <input
          id={id}
          type="tel"
          disabled={disabled}
          value={parsed.nationalNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          className={`w-full h-[48px] px-4 bg-slate-50 border rounded-r-xl font-medium text-slate-900 placeholder:text-slate-400 text-sm outline-none transition-all ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-400/20"
              : "border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300"
          } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-100" : ""}`}
        />
      </div>
    </div>
  );
}

