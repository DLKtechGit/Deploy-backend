const Categories= require('../models/categorySchema');
const Feed = require('../models/feedModel');



exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Categories.find({}, { _id: 1, name: 1 })
      .sort({ createdAt: -1 })
      .lean(); 

    if (!categories.length) {
      return res.status(404).json({ message: 'No Categories found' });
    }

    const formattedCategories = categories.map(cat => ({
      categoryId: cat._id,
      categoriesName: cat.name,
    }));

    return res.status(200).json(formattedCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



exports.getCategoryWithId = async (req, res) => {
  try {
    const  {categoryId}  = req.body;
    
    const categoriesFeeds = await Categories.findById(categoryId).populate('feedIds');

    if (!categoriesFeeds) {
      return res.status(400).json({ message: 'Videos not Found in this categories' });
    }

    res.status(200).json({
      categoriesFeeds
    });
  } catch (error) {
    console.error('Error fetching categories feeds:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.getContentCategories = async (req, res) => {
  try {
    // Find categories where feedId array is not empty
    const categories = await Categories.find({ feedIds: { $exists: true, $not: { $size: 0 } } })
      .select("_id name ")
      .sort({ createdAt: -1 })
      .lean();

    if (!categories.length) {
      return res.status(404).json({ message: "No categories with content found" });
    }

    res.status(200).json({
      message: "Categories with content retrieved successfully",
      categories,
    });
  } catch (error) {
    console.error("Error fetching content categories:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



