import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import User from "@/models/User";
import { sendNotification, notifyAdmins } from "@/lib/notifications";

// In production, this should be triggered by a service like Vercel Cron, AWS EventBridge, or a simple external cron ping.
// Secure it using a secret token configured in environment variables.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    
    // For local dev, allow if no CRON_SECRET is set, but in prod require it.
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const now = new Date();

    // 1. Stale Tracking Checks
    // Check for trips in progress where driver location hasn't updated in > 5 minutes
    const staleThreshold = new Date(now.getTime() - 5 * 60 * 1000);
    const staleBookings = await Booking.find({
      status: { $in: ["DRIVER_EN_ROUTE", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"] },
      "driverLocation.updatedAt": { $lt: staleThreshold }
    }).lean();

    for (const booking of staleBookings) {
      if (booking.driverId) {
        await sendNotification({
          recipientId: booking.driverId.toString(),
          type: "STALE_TRACKING",
          title: "Location Tracking Stopped",
          message: `Your location is not updating for booking ${booking.bookingReference}. Please check your connection or app permissions.`,
          link: `/driver/booking/${booking._id.toString()}`,
          deduplicationKey: `stale_tracking_driver_${booking._id.toString()}_${now.getHours()}` // Dedup per hour
        });
      }
      
      if (booking.touristId) {
        await sendNotification({
          recipientId: booking.touristId.toString(),
          type: "STALE_TRACKING",
          title: "Tracking Temporarily Unavailable",
          message: `Driver location for ${booking.bookingReference} is temporarily unavailable. The driver is still on their way.`,
          link: `/my-bookings?ref=${booking.bookingReference}`,
          deduplicationKey: `stale_tracking_rider_${booking._id.toString()}_${now.getHours()}`
        });
      }
      
      await notifyAdmins({
        type: "STALE_TRACKING",
        title: "Stale Tracking Alert",
        message: `Tracking for active trip ${booking.bookingReference} has stopped updating.`,
        link: `/admin/trips/${booking._id.toString()}`,
        deduplicationKey: `stale_tracking_admin_${booking._id.toString()}_${now.getHours()}`
      });
    }

    // 2. Upcoming Trip Reminders
    // Remind 24 hours before
    const tomorrowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
    
    const upcomingBookings = await Booking.find({
      status: { $in: ["CONFIRMED", "DRIVER_ASSIGNED"] },
      arrivalDate: { $gte: tomorrowStart, $lt: tomorrowEnd }
    }).lean();

    for (const booking of upcomingBookings) {
      if (booking.touristId) {
        await sendNotification({
          recipientId: booking.touristId.toString(),
          type: "UPCOMING_TRIP",
          title: "Upcoming Trip Reminder",
          message: `You have a trip scheduled for tomorrow: ${booking.bookingReference}.`,
          link: `/my-bookings?ref=${booking.bookingReference}`,
          deduplicationKey: `upcoming_trip_rider_${booking._id.toString()}`
        });
      }
      if (booking.driverId) {
        await sendNotification({
          recipientId: booking.driverId.toString(),
          type: "UPCOMING_TRIP",
          title: "Upcoming Assigned Trip",
          message: `Reminder: You are scheduled to drive for ${booking.bookingReference} tomorrow.`,
          link: `/driver/booking/${booking._id.toString()}`,
          deduplicationKey: `upcoming_trip_driver_${booking._id.toString()}`
        });
      }
    }

    // 3. Document Expiry Reminders
    // Remind drivers whose license or insurance expires in exactly 30 days
    const expiryStart = new Date(now.getTime() + 29.5 * 24 * 60 * 60 * 1000);
    const expiryEnd = new Date(now.getTime() + 30.5 * 24 * 60 * 60 * 1000);
    
    const expiringDrivers = await User.find({
      role: "DRIVER",
      "driverDetails.licenseExpiryDate": {
        $gte: expiryStart.toISOString().split('T')[0],
        $lt: expiryEnd.toISOString().split('T')[0]
      }
    }).lean();

    for (const driver of expiringDrivers) {
      await sendNotification({
        recipientId: driver._id.toString(),
        type: "DOC_EXPIRY",
        title: "License Expiring Soon",
        message: `Your driving license will expire in 30 days. Please renew and update your profile to stay approved.`,
        link: `/profile`,
        deduplicationKey: `license_expiry_driver_${driver._id.toString()}_${now.getFullYear()}_${now.getMonth()}`
      });
      
      await notifyAdmins({
        type: "DOC_EXPIRY",
        title: "Driver License Expiring",
        message: `Driver ${driver.name}'s license will expire in 30 days.`,
        link: `/admin/users/${driver._id.toString()}`,
        deduplicationKey: `license_expiry_admin_${driver._id.toString()}_${now.getFullYear()}_${now.getMonth()}`
      });
    }

    return NextResponse.json({ 
      message: "Cron executed successfully",
      stats: {
        staleTrackingAlerts: staleBookings.length,
        upcomingTripReminders: upcomingBookings.length,
        documentExpiryReminders: expiringDrivers.length
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Cron execution error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
