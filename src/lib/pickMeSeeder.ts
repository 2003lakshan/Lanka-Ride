import dbConnect from "@/lib/mongodb";
import PickMeCategory, { DEFAULT_PICKME_CATEGORIES, IPickMeCategory } from "@/models/PickMeCategory";

/**
 * Ensures the 6 PickMe vehicle categories exist in the database with configurable rates.
 * If any categories are missing, inserts them with default values.
 */
export async function ensurePickMeCategories(): Promise<IPickMeCategory[]> {
  await dbConnect();

  for (const def of DEFAULT_PICKME_CATEGORIES) {
    const existing = await PickMeCategory.findOne({ category: def.category });
    if (!existing) {
      await PickMeCategory.create(def);
    }
  }

  return PickMeCategory.find().sort({ sortOrder: 1, baseFare: 1 }).lean();
}
