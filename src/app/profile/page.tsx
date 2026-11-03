import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  await dbConnect();
  
  // Fetch fresh user data to pass to client
  const user = await User.findById((session.user as any).id).select("-password").lean();
  
  if (!user) {
    redirect("/login");
  }

  const serializedUser = {
    ...user,
    _id: user._id.toString(),
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString()
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Account Settings</h1>
          <p className="text-slate-600 mt-2">Manage your profile, preferences, and account security.</p>
        </div>
        
        <ProfileClient initialUser={serializedUser} sessionHasPassword={!!user.password} />
      </div>
    </div>
  );
}
