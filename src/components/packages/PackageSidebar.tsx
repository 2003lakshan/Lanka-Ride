"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package as PackageIcon, Edit2, Save, X, Calendar, Users, DollarSign, MapPin } from "lucide-react";

export default function PackageSidebar({ pkg, isDriver }: { pkg: any, isDriver: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: pkg.title,
    shortDescription: pkg.shortDescription,
    days: pkg.days,
    nights: pkg.nights,
    minPassengers: pkg.minPassengers,
    maxPassengers: pkg.maxPassengers,
    totalStartingPrice: pkg.costs?.totalStartingPrice || 0,
  });

  // Sync form data with incoming props if the driver is not currently editing it
  useEffect(() => {
    if (!isEditing) {
      setFormData({
        title: pkg.title,
        shortDescription: pkg.shortDescription,
        days: pkg.days,
        nights: pkg.nights,
        minPassengers: pkg.minPassengers,
        maxPassengers: pkg.maxPassengers,
        totalStartingPrice: pkg.costs?.totalStartingPrice || 0,
      });
    }
  }, [pkg, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        shortDescription: formData.shortDescription,
        days: Number(formData.days),
        nights: Number(formData.nights),
        minPassengers: Number(formData.minPassengers),
        maxPassengers: Number(formData.maxPassengers),
        costs: {
          ...pkg.costs,
          totalStartingPrice: Number(formData.totalStartingPrice)
        }
      };

      const res = await fetch(`/api/driver/packages/${pkg._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update package");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving package");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="relative h-48 w-full bg-slate-900 shrink-0">
        <img src={pkg.coverPhoto} alt={pkg.title} className="w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
          <div>
            <div className="bg-blue-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider inline-block mb-1">
              {pkg.category}
            </div>
            {isEditing ? (
              <input 
                name="title" 
                value={formData.title} 
                onChange={handleChange} 
                className="w-full bg-white/20 border border-white/40 text-white rounded px-2 py-1 text-lg font-bold outline-none focus:bg-white/90 focus:text-slate-900"
              />
            ) : (
              <h2 className="text-xl font-bold text-white line-clamp-2">{pkg.title}</h2>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <PackageIcon size={18} className="text-blue-600" /> Package Details
          </h3>
          {isDriver && (
            <button 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={saving}
              className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ${
                isEditing ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isEditing ? (
                <>{saving ? "Saving..." : <><Save size={14} /> Save</>}</>
              ) : (
                <><Edit2 size={14} /> Edit</>
              )}
            </button>
          )}
          {isDriver && isEditing && !saving && (
             <button 
               onClick={() => setIsEditing(false)}
               className="ml-2 bg-red-100 text-red-600 hover:bg-red-200 p-1.5 rounded-lg"
             >
               <X size={14} />
             </button>
          )}
        </div>

        <div className="space-y-6">
          
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Description</label>
            {isEditing ? (
              <textarea 
                name="shortDescription" 
                value={formData.shortDescription} 
                onChange={handleChange} 
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{pkg.shortDescription}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Calendar size={12}/> Duration</div>
              {isEditing ? (
                <div className="flex gap-2">
                  <input type="number" name="days" value={formData.days} onChange={handleChange} className="w-full border rounded px-2 py-1 text-sm font-bold" />
                  <span className="text-sm self-center">D</span>
                  <input type="number" name="nights" value={formData.nights} onChange={handleChange} className="w-full border rounded px-2 py-1 text-sm font-bold" />
                  <span className="text-sm self-center">N</span>
                </div>
              ) : (
                <div className="font-bold text-slate-900 text-sm">{pkg.days} Days / {pkg.nights} Nights</div>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Users size={12}/> Capacity</div>
              {isEditing ? (
                <div className="flex gap-2 items-center">
                  <input type="number" name="minPassengers" value={formData.minPassengers} onChange={handleChange} className="w-full border rounded px-2 py-1 text-sm font-bold" />
                  <span className="text-xs">-</span>
                  <input type="number" name="maxPassengers" value={formData.maxPassengers} onChange={handleChange} className="w-full border rounded px-2 py-1 text-sm font-bold" />
                </div>
              ) : (
                <div className="font-bold text-slate-900 text-sm">{pkg.minPassengers} - {pkg.maxPassengers} Pax</div>
              )}
            </div>
            
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-xs text-slate-500 flex items-center gap-1 mb-1"><MapPin size={12}/> Starting</div>
              <div className="font-bold text-slate-900 text-sm line-clamp-1">{pkg.startingCity}</div>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
              <div className="text-xs text-blue-600 font-bold flex items-center gap-1 mb-1"><DollarSign size={12}/> Total Price</div>
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold">LKR</span>
                  <input type="number" name="totalStartingPrice" value={formData.totalStartingPrice} onChange={handleChange} className="w-full border border-blue-200 rounded px-2 py-1 text-sm font-bold" />
                </div>
              ) : (
                <div className="font-extrabold text-blue-900 text-sm">LKR {pkg.costs?.totalStartingPrice?.toLocaleString()}</div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
