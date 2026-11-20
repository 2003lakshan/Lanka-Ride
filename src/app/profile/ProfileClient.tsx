"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { User, Mail, Phone, Globe, ShieldAlert, AlertTriangle, Save, Loader2, CheckCircle, Upload, X } from "lucide-react";

export default function ProfileClient({ initialUser, sessionHasPassword }: { initialUser: any, sessionHasPassword: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const { update: updateSession } = useSession();
  const isDriver = initialUser.role === "DRIVER";
  
  const [formData, setFormData] = useState({
    name: initialUser.name || "",
    email: initialUser.email || "",
    phoneNumber: initialUser.phoneNumber || "",
    nationality: initialUser.nationality || "",
    preferredLanguage: initialUser.preferredLanguage || "English",
    profilePhoto: initialUser.profilePhoto || "",
    
    // Driver fields
    vehicleCategory: initialUser.vehicleCategory || initialUser.driverDetails?.vehicleCategory || "Car",
    licenseNumber: initialUser.licenseNumber || "",
    vehicleRegistration: initialUser.vehicleRegistration || "",
    vehicleMake: initialUser.driverDetails?.vehicleMake || "",
    vehicleModel: initialUser.driverDetails?.vehicleModel || "",
    languagesSpoken: Array.isArray(initialUser.driverDetails?.languagesSpoken)
      ? initialUser.driverDetails.languagesSpoken.join(", ")
      : (initialUser.driverDetails?.languagesSpoken || ""),
    areasServed: initialUser.driverDetails?.areasServed || "",
    shortBio: initialUser.driverDetails?.shortBio || "",
    yearsOfExperience: initialUser.driverDetails?.yearsOfExperience ?? "",
    homeCity: initialUser.driverDetails?.homeCity || "",
    specialities: Array.isArray(initialUser.driverDetails?.specialities)
      ? initialUser.driverDetails.specialities.join(", ")
      : (initialUser.driverDetails?.specialities || ""),
    nicOrPassportNumber: initialUser.driverDetails?.nicOrPassportNumber || "",
    licenseExpiryDate: initialUser.driverDetails?.licenseExpiryDate || "",
    insurancePolicyNumber: initialUser.driverDetails?.insurancePolicyNumber || "",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Check if email or phone changed
  const contactChanged = formData.email !== initialUser.email || formData.phoneNumber !== initialUser.phoneNumber;
  const sensitiveDocsChanged = isDriver && (
    formData.licenseNumber !== initialUser.licenseNumber ||
    formData.vehicleRegistration !== initialUser.vehicleRegistration ||
    formData.nicOrPassportNumber !== (initialUser.driverDetails?.nicOrPassportNumber || "") ||
    formData.licenseExpiryDate !== (initialUser.driverDetails?.licenseExpiryDate || "") ||
    formData.insurancePolicyNumber !== (initialUser.driverDetails?.insurancePolicyNumber || "")
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage({ type: "", text: "" });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        nationality: formData.nationality,
        preferredLanguage: formData.preferredLanguage,
        profilePhoto: formData.profilePhoto,
        currentPassword: contactChanged ? currentPassword : undefined
      };

      if (isDriver) {
        payload.vehicleCategory = formData.vehicleCategory;
        payload.licenseNumber = formData.licenseNumber;
        payload.vehicleRegistration = formData.vehicleRegistration;
        payload.driverDetails = {
          vehicleMake: formData.vehicleMake,
          vehicleModel: formData.vehicleModel,
          languagesSpoken: formData.languagesSpoken ? formData.languagesSpoken.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
          areasServed: formData.areasServed,
          shortBio: formData.shortBio,
          yearsOfExperience: formData.yearsOfExperience !== "" ? Number(formData.yearsOfExperience) : undefined,
          homeCity: formData.homeCity,
          specialities: formData.specialities ? formData.specialities.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
          nicOrPassportNumber: formData.nicOrPassportNumber,
          licenseExpiryDate: formData.licenseExpiryDate,
          insurancePolicyNumber: formData.insurancePolicyNumber,
        };
      }

      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresPassword) {
           setMessage({ type: "error", text: "Current password is required to change email or phone number." });
        } else {
           setMessage({ type: "error", text: data.error || "Failed to update profile." });
        }
      } else {
        setMessage({ 
          type: "success", 
          text: data.approvalRevoked 
            ? "Profile updated. Notice: Changes to verified documents require admin re-approval. Your status is now Pending." 
            : returnUrl
            ? "Profile updated successfully! Returning to your booking..."
            : "Profile updated successfully." 
        });
        setCurrentPassword("");
        
        // Refresh session to reflect changes in Navbar etc
        await updateSession();
        router.refresh();

        if (returnUrl) {
          setTimeout(() => {
            router.push(returnUrl);
          }, 1200);
        }
      }
    } catch (err) {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCheck = async () => {
    setDeleteCheckLoading(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setDeleteError(data.reason || data.error);
      } else {
        setDeleteModalOpen(true);
      }
    } catch (err) {
      setDeleteError("Failed to verify account deletion eligibility.");
    } finally {
      setDeleteCheckLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmationText !== "DELETE") return;
    if (sessionHasPassword && !currentPassword) {
      setDeleteError("Please enter your password to confirm.");
      return;
    }
    
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", currentPassword })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setDeleteError(data.error);
        setDeleting(false);
      } else {
        await signOut({ callbackUrl: "/" });
      }
    } catch (err) {
      setDeleteError("An unexpected error occurred during deletion.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {returnUrl && (
        <div className="bg-amber-50 border border-amber-200/90 text-amber-900 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">Completing profile for Local Ride booking</p>
              <p className="text-xs text-amber-700">Please provide your phone number so your driver can reach you for pickup.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(returnUrl)}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-900 font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <span>Return to Ride</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      
      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {message.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          <p className="font-medium text-sm">{message.text}</p>
        </div>
      )}

      {sensitiveDocsChanged && initialUser.isApproved && (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
          <ShieldAlert size={20} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium leading-relaxed">
            You are changing sensitive verified documents (Identity, Licence, or Vehicle Registration). Saving these changes will <strong className="font-extrabold">revoke your approved status</strong> and require a new admin review before you can accept bookings again.
          </p>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
        
        {/* Basic Information */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">Profile Photo URL</label>
              <div className="flex items-center gap-4">
                {formData.profilePhoto ? (
                  <img src={formData.profilePhoto} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <User className="text-slate-400" size={24} />
                  </div>
                )}
                <input 
                  type="text" 
                  name="profilePhoto" 
                  value={formData.profilePhoto} 
                  onChange={handleInputChange}
                  placeholder="https://example.com/photo.jpg" 
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
              <input 
                type="text" 
                name="name" 
                required 
                value={formData.name} 
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nationality</label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="text" 
                  name="nationality" 
                  value={formData.nationality} 
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Preferred Language</label>
              <select 
                name="preferredLanguage" 
                value={formData.preferredLanguage} 
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="English">English</option>
                <option value="Russian">Russian</option>
                <option value="German">German</option>
                <option value="French">French</option>
                <option value="Chinese">Chinese</option>
                <option value="Arabic">Arabic</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Contact Details (Login)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="email" 
                  name="email" 
                  required 
                  value={formData.email} 
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="tel" 
                  name="phoneNumber" 
                  required 
                  value={formData.phoneNumber} 
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
          
          {contactChanged && sessionHasPassword && (
            <div className="mt-4 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in slide-in-from-top-2">
              <label className="block text-sm font-bold text-blue-900 mb-2">Current Password Required</label>
              <p className="text-xs text-blue-700 mb-3">You are changing your login email or phone number. Please enter your current password to verify.</p>
              <input 
                type="password" 
                required 
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full md:w-1/2 px-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
            </div>
          )}
        </div>

        {/* Driver Public Profile (Meet Your Driver) */}
        {isDriver && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Tour Host & Public Profile (“Meet Your Driver”)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  These details are displayed on your travel packages and public driver profile for travellers to learn about you.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full mt-2 sm:mt-0">
                Publicly Visible
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Short Introduction / Bio
                </label>
                <textarea
                  name="shortBio"
                  rows={3}
                  value={formData.shortBio}
                  onChange={e => {
                    setFormData({ ...formData, shortBio: e.target.value });
                    setMessage({ type: "", text: "" });
                  }}
                  placeholder="Tell travellers about yourself, your driving career, and your enthusiasm for showing the beauties of Sri Lanka..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Years of Driving & Tour Experience
                </label>
                <p className="text-[11px] text-slate-400 mb-2">Clearly labeled as self-reported on your public package profile.</p>
                <input
                  type="number"
                  min={0}
                  max={50}
                  name="yearsOfExperience"
                  value={formData.yearsOfExperience}
                  onChange={handleInputChange}
                  placeholder="e.g. 8"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Home City
                </label>
                <p className="text-[11px] text-slate-400 mb-2">Your base city in Sri Lanka (e.g. Kandy, Negombo, Galle).</p>
                <input
                  type="text"
                  name="homeCity"
                  value={formData.homeCity}
                  onChange={handleInputChange}
                  placeholder="e.g. Kandy"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Operating Areas / Regional Coverage
                </label>
                <p className="text-[11px] text-slate-400 mb-2">Areas or routes you specialize in driving.</p>
                <input
                  type="text"
                  name="areasServed"
                  value={formData.areasServed}
                  onChange={handleInputChange}
                  placeholder="e.g. Island-wide, Hill Country, Cultural Triangle"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tour Specialities & Local Knowledge
                </label>
                <p className="text-[11px] text-slate-400 mb-2">Comma separated (e.g. Wildlife Safaris, Ancient Temples, Tea Country).</p>
                <input
                  type="text"
                  name="specialities"
                  value={formData.specialities}
                  onChange={handleInputChange}
                  placeholder="e.g. Wildlife Safaris, Ancient Cities, Photography Spots"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Languages Spoken
                </label>
                <p className="text-[11px] text-slate-400 mb-2">Comma separated (e.g. English, Sinhala, German, Tamil).</p>
                <input
                  type="text"
                  name="languagesSpoken"
                  value={formData.languagesSpoken}
                  onChange={handleInputChange}
                  placeholder="e.g. English, Sinhala, German"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Driver Specific Information */}
        {isDriver && (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Driver & Vehicle Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Vehicle Make & Model</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    name="vehicleMake" 
                    placeholder="Toyota" 
                    value={formData.vehicleMake} 
                    onChange={handleInputChange}
                    className="w-1/2 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <input 
                    type="text" 
                    name="vehicleModel" 
                    placeholder="Prius" 
                    value={formData.vehicleModel} 
                    onChange={handleInputChange}
                    className="w-1/2 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Driving Vehicle Category</label>
                <select
                  name="vehicleCategory"
                  value={formData.vehicleCategory}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium bg-white"
                >
                  <option value="Car">Car (Sedan / Hatchback)</option>
                  <option value="Mini Van">Mini Van</option>
                  <option value="Three-wheeler">Three-wheeler (Tuk-Tuk)</option>
                  <option value="Bike">Bike</option>
                  <option value="Van">Van (Passenger)</option>
                  <option value="Lorry">Lorry (Goods Transport)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Vehicle Registration Plate</label>
                <input 
                  type="text" 
                  name="vehicleRegistration" 
                  value={formData.vehicleRegistration} 
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">NIC / Passport Number</label>
                <input 
                  type="text" 
                  name="nicOrPassportNumber" 
                  value={formData.nicOrPassportNumber} 
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Driving License Number</label>
                <input 
                  type="text" 
                  name="licenseNumber" 
                  value={formData.licenseNumber} 
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">License Expiry Date</label>
                <input 
                  type="date" 
                  name="licenseExpiryDate" 
                  value={formData.licenseExpiryDate} 
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Insurance Policy Number</label>
                <input 
                  type="text" 
                  name="insurancePolicyNumber" 
                  value={formData.insurancePolicyNumber} 
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Languages Spoken</label>
                <input 
                  type="text" 
                  name="languagesSpoken" 
                  placeholder="e.g. English, Sinhala" 
                  value={formData.languagesSpoken} 
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Areas Served</label>
                <input 
                  type="text" 
                  name="areasServed" 
                  placeholder="e.g. Colombo, Kandy, All Island" 
                  value={formData.areasServed} 
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>

      {/* Delete Account Section */}
      <div className="bg-rose-50 rounded-3xl border border-rose-200 p-6 md:p-8 mt-12">
        <h2 className="text-xl font-bold text-rose-900 mb-2 flex items-center gap-2">
          <AlertTriangle size={24} className="text-rose-600" /> Danger Zone: Delete Account
        </h2>
        <p className="text-rose-700 mb-6 max-w-3xl leading-relaxed text-sm">
          Permanently delete your account, profile, and personal data. This action cannot be undone. If you are a driver, your published packages will also be removed. Historical transaction records will be retained but anonymized.
        </p>
        
        {deleteError && !deleteModalOpen && (
          <div className="bg-white/80 p-4 rounded-xl border border-rose-300 text-rose-800 text-sm font-medium mb-4 flex gap-3 items-start animate-in fade-in">
            <X size={18} className="flex-shrink-0 mt-0.5" />
            <span>{deleteError}</span>
          </div>
        )}

        <button 
          onClick={handleDeleteCheck}
          disabled={deleteCheckLoading}
          className="bg-white border-2 border-rose-200 text-rose-700 hover:bg-rose-600 hover:border-rose-600 hover:text-white font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {deleteCheckLoading ? <Loader2 size={18} className="animate-spin" /> : null}
          Delete My Account
        </button>
      </div>

      {/* Deletion Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Permanently delete your account?</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Your account and profile will be permanently deleted. You will lose access to your bookings and messages. Active tour packages will be removed. Past transaction records will be anonymized. <strong className="font-bold text-rose-600">This action cannot be undone.</strong>
              </p>

              {deleteError && (
                <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm mb-6 border border-rose-200">
                  {deleteError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Type <span className="font-mono bg-slate-100 px-1 rounded text-rose-600">DELETE</span> to confirm:
                  </label>
                  <input 
                    type="text" 
                    value={deleteConfirmationText}
                    onChange={e => setDeleteConfirmationText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                
                {sessionHasPassword && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Verify with your password:</label>
                    <input 
                      type="password" 
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Current Password"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 p-6 flex flex-col sm:flex-row gap-3 justify-end">
              <button 
                onClick={() => { setDeleteModalOpen(false); setDeleteError(""); setCurrentPassword(""); setDeleteConfirmationText(""); }}
                disabled={deleting}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                disabled={deleting || deleteConfirmationText !== "DELETE" || (sessionHasPassword && !currentPassword)}
                className="px-6 py-2.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:hover:bg-rose-600 flex justify-center items-center gap-2"
              >
                {deleting ? <Loader2 size={18} className="animate-spin" /> : null}
                Permanently Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
