const User =require('../models/userModels/userModel')

exports.startUpProcessCheck = async (userId) => {
  try {
    const exists = await User.exists({
      _id: userId,
      appLanguage: { $ne: null },
      feedLanguage: { $ne: null },
    });

    return !!exists; // true if user has both set
  } catch (error) {
    console.error("Error in startUpProcessCheck:", error);
    return false;
  }
};
