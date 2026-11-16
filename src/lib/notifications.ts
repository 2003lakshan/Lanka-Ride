import dbConnect from "@/lib/mongodb";
import Notification from "@/models/Notification";
import User from "@/models/User";

export interface NotificationOptions {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  resourceId?: string;
  link?: string;
  deduplicationKey?: string;
}

/**
 * Sends a notification to a specific user.
 * Automatically deduplicates based on the deduplicationKey.
 */
export async function sendNotification(options: NotificationOptions) {
  try {
    await dbConnect();
    
    let notifDoc;
    if (options.deduplicationKey) {
      // Upsert to handle deduplication
      notifDoc = await Notification.findOneAndUpdate(
        { deduplicationKey: options.deduplicationKey },
        {
          $setOnInsert: {
            recipientId: options.recipientId,
            type: options.type,
            title: options.title,
            message: options.message,
            resourceId: options.resourceId,
            link: options.link,
            isRead: false
          }
        },
        { upsert: true, new: true }
      );
    } else {
      notifDoc = await Notification.create({
        recipientId: options.recipientId,
        type: options.type,
        title: options.title,
        message: options.message,
        resourceId: options.resourceId,
        link: options.link,
        isRead: false
      });
    }

    // Realtime broadcast of new notification and unread count
    if (notifDoc) {
      const unreadCount = await Notification.countDocuments({
        recipientId: options.recipientId,
        isRead: false,
      });

      import("@/lib/realtime").then(({ broadcastNotification }) => {
        broadcastNotification(options.recipientId, notifDoc, unreadCount);
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Failed to send notification:", err);
    // Suppress error so we don't break booking workflows on notification failures
  }
}

/**
 * Sends a notification to all ADMIN users.
 */
export async function notifyAdmins(options: Omit<NotificationOptions, "recipientId">) {
  try {
    await dbConnect();
    const admins = await User.find({ role: "ADMIN" }).select("_id").lean();
    
    // Fire and forget individually for deduplication logic to work nicely, 
    // or batch them if no deduplication key.
    for (const admin of admins) {
      const dedupKey = options.deduplicationKey ? `${options.deduplicationKey}_admin_${admin._id.toString()}` : undefined;
      
      await sendNotification({
        ...options,
        recipientId: admin._id.toString(),
        deduplicationKey: dedupKey
      });
    }
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }
}

/**
 * Sends a notification to all active/eligible DRIVER users matching vehicle category.
 */
export async function notifyEligibleDrivers(
  options: Omit<NotificationOptions, "recipientId"> & { vehicleCategory?: string }
) {
  try {
    await dbConnect();
    // Eligible means approved drivers
    const drivers = await User.find({ role: "DRIVER", isApproved: true })
      .select("_id vehicleCategory driverDetails driverProfile")
      .lean();

    const { isVehicleCategoryCompatible } = await import("@/lib/nearbyDispatch");

    for (const driver of drivers) {
      if (options.vehicleCategory) {
        const dCat =
          driver.vehicleCategory ||
          driver.driverDetails?.vehicleCategory ||
          (driver as any).driverProfile?.vehicleDetails?.category;
        if (!isVehicleCategoryCompatible(dCat, options.vehicleCategory)) {
          continue;
        }
      }

      const dedupKey = options.deduplicationKey ? `${options.deduplicationKey}_drv_${driver._id.toString()}` : undefined;
      
      await sendNotification({
        ...options,
        recipientId: driver._id.toString(),
        deduplicationKey: dedupKey
      });
    }
  } catch (err) {
    console.error("Failed to notify drivers:", err);
  }
}
