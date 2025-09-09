const UserCategory=require('../../models/userModels/userCategotyModel')


exports.userSelectCategory = async (req, res) => {
  try {
    const { categoryIds } = req.body; // Expecting array of categoryIds
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ message: "At least one Category ID is required" });
    }

    // ✅ Ensure UserCategory doc exists
    let userCategory = await UserCategory.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, interestedCategories: [], nonInterestedCategories: [] } },
      { new: true, upsert: true }
    );

    // ✅ Convert existing IDs to string for comparison
    const existingInterested = userCategory.interestedCategories.map(id => id.toString());

    // ✅ Separate new vs existing
    const toInsert = categoryIds.filter(id => !existingInterested.includes(id));

    if (toInsert.length > 0) {
      await UserCategory.updateOne(
        { userId },
        { $addToSet: { interestedCategories: { $each: toInsert } } }
      );
    }

    // ✅ Fetch final updated doc
    const updatedDoc = await UserCategory.findOne({ userId })
      .populate("interestedCategories", "name") // optional populate
      .populate("nonInterestedCategories", "name")
      .lean();

    res.status(200).json({
      message: "Categories selected successfully",
      data: updatedDoc,
    });
  } catch (err) {
    console.error("Error selecting categories:", err);
    res.status(500).json({
      message: "Error selecting categories",
      error: err.message,
    });
  }
};



exports.userUnSelectCategory = async (req, res) => {
  try {
    const { categoryIds, nonInterestedIds } = req.body; 
    // categoryIds -> interested categories
    // nonInterestedIds -> non-interested categories selected by user
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!Array.isArray(categoryIds) || !Array.isArray(nonInterestedIds)) {
      return res.status(400).json({ message: "Both categoryIds and nonInterestedIds should be arrays" });
    }

    // ✅ Ensure UserCategory doc exists
    let userCategory = await UserCategory.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, interestedCategories: [], nonInterestedCategories: [] } },
      { new: true, upsert: true }
    );

    // ✅ Convert IDs to string for comparison
    const existingInterested = userCategory.interestedCategories.map(id => id.toString());
    const existingNonInterested = userCategory.nonInterestedCategories.map(id => id.toString());
    const newInterested = categoryIds.map(id => id.toString());
    const newNonInterested = nonInterestedIds.map(id => id.toString());

    /** -------------------
     *  1) Interested Flow
     * ------------------- */
    const toInsert = newInterested.filter(id => !existingInterested.includes(id));
    const toUnselect = existingInterested.filter(id => !newInterested.includes(id));

    // Add newly selected interested
    if (toInsert.length > 0) {
      await UserCategory.updateOne(
        { userId },
        { $addToSet: { interestedCategories: { $each: toInsert } } }
      );
    }

    // Move unselected interested → nonInterested
    if (toUnselect.length > 0) {
      await UserCategory.updateOne(
        { userId },
        {
          $pull: { interestedCategories: { $in: toUnselect } },
          $addToSet: { nonInterestedCategories: { $each: toUnselect } }
        }
      );
    }

    /** -------------------
     *  2) Non-Interested Flow
     * ------------------- */
    for (let catId of newNonInterested) {
      if (existingInterested.includes(catId)) {
        // If already in interested → move it
        await UserCategory.updateOne(
          { userId },
          {
            $pull: { interestedCategories: catId },
            $addToSet: { nonInterestedCategories: catId }
          }
        );
      } else if (!existingNonInterested.includes(catId)) {
        // If not in interested → just add to nonInterested
        await UserCategory.updateOne(
          { userId },
          { $addToSet: { nonInterestedCategories: catId } }
        );
      }
    }

    // ✅ Fetch final updated doc
    const updatedDoc = await UserCategory.findOne({ userId })
      .populate("interestedCategories", "name")
      .populate("nonInterestedCategories", "name")
      .lean();

    res.status(200).json({
      message: "Categories updated successfully",
      data: updatedDoc,
    });
  } catch (err) {
    console.error("Error updating categories:", err);
    res.status(500).json({
      message: "Error updating categories",
      error: err.message,
    });
  }
};








