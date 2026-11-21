"use client";

import { useState } from "react";
import Link from "next/link";
import { Car, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import BrandLogo from "@/components/brand/BrandLogo";

const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xl font-bold text-slate-800 border-b-2 border-slate-200 pb-3 mt-10 mb-6">{title}</h3>
);

const InputField = ({ label, name, type = "text", placeholder = "", required = false, formData, handleChange }: any) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-2">{label} {required && <span className="text-red-500">*</span>}</label>
    <input type={type} name={name} required={required} value={(formData as any)[name] || ""} onChange={handleChange} className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 transition-all text-slate-800" placeholder={placeholder} />
  </div>
);

const SelectField = ({ label, name, options, required = false, formData, handleChange }: any) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-2">{label} {required && <span className="text-red-500">*</span>}</label>
    <select name={name} required={required} value={(formData as any)[name] || ""} onChange={handleChange} className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 transition-all text-slate-800">
      {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

export default function DriverRegistrationPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phoneNumber: "",
    licenseNumber: "",
    vehicleRegistration: "",
    // Driver identity
    nicOrPassportNumber: "",
    dateOfBirth: "",
    homeDistrict: "",
    // Driving licence
    licenseClasses: "",
    licenseExpiryDate: "",
    // Vehicle
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    passengerSeats: "",
    luggageCapacity: "",
    // Vehicle documents
    insurancePolicyNumber: "",
    insuranceExpiryDate: "",
    revenueLicenseExpiryDate: "",
    // Tour service
    languagesSpoken: "",
    areasServed: "",
    airportPickupAvailable: "true",
    multiDayTripAvailable: "true",
    guidedToursAvailable: "true",
    // Safety and operations
    emergencyContactName: "",
    emergencyContactNumber: "",
    childSeatAvailable: "false",
    airConditioning: "true",
    availabilitySchedule: "",
    // Payment
    bankAccountName: "",
    bankAccountNumber: "",
    bankName: "",
    bankBranchName: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phoneNumber: formData.phoneNumber,
          licenseNumber: formData.licenseNumber,
          vehicleRegistration: formData.vehicleRegistration,
          role: "DRIVER",
          driverDetails: {
            nicOrPassportNumber: formData.nicOrPassportNumber,
            dateOfBirth: formData.dateOfBirth,
            homeDistrict: formData.homeDistrict,
            licenseClasses: formData.licenseClasses,
            licenseExpiryDate: formData.licenseExpiryDate,
            vehicleMake: formData.vehicleMake,
            vehicleModel: formData.vehicleModel,
            vehicleYear: formData.vehicleYear,
            passengerSeats: formData.passengerSeats,
            luggageCapacity: formData.luggageCapacity,
            insurancePolicyNumber: formData.insurancePolicyNumber,
            insuranceExpiryDate: formData.insuranceExpiryDate,
            revenueLicenseExpiryDate: formData.revenueLicenseExpiryDate,
            languagesSpoken: formData.languagesSpoken,
            areasServed: formData.areasServed,
            airportPickupAvailable: formData.airportPickupAvailable === "true",
            multiDayTripAvailable: formData.multiDayTripAvailable === "true",
            guidedToursAvailable: formData.guidedToursAvailable === "true",
            emergencyContactName: formData.emergencyContactName,
            emergencyContactNumber: formData.emergencyContactNumber,
            childSeatAvailable: formData.childSeatAvailable === "true",
            airConditioning: formData.airConditioning === "true",
            availabilitySchedule: formData.availabilitySchedule,
            bankAccountName: formData.bankAccountName,
            bankAccountNumber: formData.bankAccountNumber,
            bankName: formData.bankName,
            bankBranchName: formData.bankBranchName,
          }
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to register as driver");
      }

      const signInResult = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        role: "DRIVER",
        redirect: false,
      });

      if (signInResult?.error) {
        throw new Error(signInResult.error);
      }

      router.push("/driver");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-4xl mx-auto space-y-8 bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-200 z-10 relative">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <BrandLogo variant="icon" size="xl" linkToHome={true} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Driver Registration</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium max-w-lg mx-auto">
            Complete the form below to register as a driver. Your application will be reviewed by an admin before you can start accepting rides.
          </p>
        </div>
        
        <form className="mt-8 space-y-4" onSubmit={handleSignup}>
          
          <SectionTitle title="Account Setup" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Full Name" name="name" required placeholder="John Doe" formData={formData} handleChange={handleChange} />
            <InputField label="Email Address" name="email" type="email" required placeholder="driver@example.com" formData={formData} handleChange={handleChange} />
            <InputField label="Password" name="password" type="password" required placeholder="••••••••" formData={formData} handleChange={handleChange} />
            <InputField label="Phone Number" name="phoneNumber" required placeholder="+94 77 123 4567" formData={formData} handleChange={handleChange} />
          </div>

          <SectionTitle title="Driver Identity" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="NIC or Passport Number" name="nicOrPassportNumber" required formData={formData} handleChange={handleChange} />
            <InputField label="Date of Birth" name="dateOfBirth" type="date" required formData={formData} handleChange={handleChange} />
            <InputField label="Home District" name="homeDistrict" required formData={formData} handleChange={handleChange} />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Profile Photo</label>
              <input type="file" className="w-full p-2 border border-slate-300 rounded-xl bg-white text-sm" accept="image/*" />
              <p className="text-xs text-slate-500 mt-1">Please upload a clear headshot.</p>
            </div>
          </div>

          <SectionTitle title="Driving Licence" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Licence Number" name="licenseNumber" required formData={formData} handleChange={handleChange} />
            <InputField label="Vehicle Classes (e.g. B, B1, C)" name="licenseClasses" required formData={formData} handleChange={handleChange} />
            <InputField label="Licence Expiry Date" name="licenseExpiryDate" type="date" required formData={formData} handleChange={handleChange} />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Licence Images</label>
              <input type="file" multiple className="w-full p-2 border border-slate-300 rounded-xl bg-white text-sm" accept="image/*" />
            </div>
          </div>

          <SectionTitle title="Vehicle Details" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField label="Registration Number" name="vehicleRegistration" required placeholder="WP CAA-1234" formData={formData} handleChange={handleChange} />
            <InputField label="Make" name="vehicleMake" required placeholder="Toyota" formData={formData} handleChange={handleChange} />
            <InputField label="Model" name="vehicleModel" required placeholder="Prius" formData={formData} handleChange={handleChange} />
            <InputField label="Year" name="vehicleYear" type="number" required placeholder="2018" formData={formData} handleChange={handleChange} />
            <InputField label="Passenger Seats" name="passengerSeats" type="number" required formData={formData} handleChange={handleChange} />
            <InputField label="Luggage Capacity (Bags)" name="luggageCapacity" type="number" required formData={formData} handleChange={handleChange} />
          </div>
          <div className="mt-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Vehicle Photos (Interior & Exterior)</label>
            <input type="file" multiple className="w-full p-2 border border-slate-300 rounded-xl bg-white text-sm" accept="image/*" />
          </div>

          <SectionTitle title="Vehicle Documents" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField label="Insurance Policy Number" name="insurancePolicyNumber" required formData={formData} handleChange={handleChange} />
            <InputField label="Insurance Expiry Date" name="insuranceExpiryDate" type="date" required formData={formData} handleChange={handleChange} />
            <InputField label="Revenue Licence Expiry" name="revenueLicenseExpiryDate" type="date" required formData={formData} handleChange={handleChange} />
          </div>

          <SectionTitle title="Tour Service Capabilities" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Languages Spoken" name="languagesSpoken" placeholder="English, Sinhala" formData={formData} handleChange={handleChange} />
            <InputField label="Areas Served" name="areasServed" placeholder="Colombo, Kandy, Galle" formData={formData} handleChange={handleChange} />
            <SelectField label="Airport Pickup Availability" name="airportPickupAvailable" options={[{label: "Yes", value: "true"}, {label: "No", value: "false"}]} formData={formData} handleChange={handleChange} />
            <SelectField label="Multi-day Trip Availability" name="multiDayTripAvailable" options={[{label: "Yes", value: "true"}, {label: "No", value: "false"}]} formData={formData} handleChange={handleChange} />
            <SelectField label="Guided Tours Offered" name="guidedToursAvailable" options={[{label: "Yes", value: "true"}, {label: "No", value: "false"}]} formData={formData} handleChange={handleChange} />
          </div>

          <SectionTitle title="Safety and Operations" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Emergency Contact Name" name="emergencyContactName" required formData={formData} handleChange={handleChange} />
            <InputField label="Emergency Contact Number" name="emergencyContactNumber" required formData={formData} handleChange={handleChange} />
            <SelectField label="Child Seat Available" name="childSeatAvailable" options={[{label: "Yes", value: "true"}, {label: "No", value: "false"}]} formData={formData} handleChange={handleChange} />
            <SelectField label="Air Conditioning" name="airConditioning" options={[{label: "Yes, fully functional", value: "true"}, {label: "No", value: "false"}]} formData={formData} handleChange={handleChange} />
            <div className="md:col-span-2">
              <InputField label="Availability Schedule" name="availabilitySchedule" placeholder="E.g. Mon-Fri 8AM-8PM, Weekends flexible" formData={formData} handleChange={handleChange} />
            </div>
          </div>

          <SectionTitle title="Payment Details" />
          <p className="text-sm text-slate-500 mb-4">Bank account details for receiving payouts.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Bank Name" name="bankName" required formData={formData} handleChange={handleChange} />
            <InputField label="Branch Name" name="bankBranchName" required formData={formData} handleChange={handleChange} />
            <InputField label="Account Name" name="bankAccountName" required formData={formData} handleChange={handleChange} />
            <InputField label="Account Number" name="bankAccountNumber" required formData={formData} handleChange={handleChange} />
          </div>

          {error && <div className="text-red-500 text-sm font-semibold text-center bg-red-50 py-3 rounded-lg border border-red-100 mt-8">{error}</div>}

          <div className="pt-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-4 px-4 text-lg font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-300"
            >
              {loading ? "Submitting Application..." : "Submit Application"}
            </button>
          </div>
          
          <div className="text-center mt-6">
            <p className="text-sm text-slate-600">
              Already have a driver account?{" "}
              <Link href="/login" className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                Log in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
