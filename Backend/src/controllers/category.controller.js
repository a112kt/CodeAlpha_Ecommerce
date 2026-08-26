const mongoose = require("mongoose");
const Category = require("../models/Category");

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};
// Create a new category
const createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    let slug = generateSlug(name);

    const existingSlug = await Category.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description ? description.trim() : "",
      image: image || "",
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: {
        category: {
          id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          image: category.image,
          isActive: category.isActive,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("CreateCategory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all active categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select("name slug description image isActive createdAt updatedAt");

    return res.status(200).json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (error) {
    console.error("GetCategories Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get a category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id).select(
      "name slug description image isActive createdAt updatedAt"
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        category,
      },
    });
  } catch (error) {
    console.error("GetCategoryById Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update a category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Category name already exists",
        });
      }
      category.name = name.trim();
      category.slug = generateSlug(name);
    }

    if (description !== undefined) {
      category.description = description.trim();
    }

    if (image !== undefined) {
      category.image = image;
    }

    if (isActive !== undefined) {
      category.isActive = isActive;
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: {
        category: {
          id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          image: category.image,
          isActive: category.isActive,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("UpdateCategory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Delete a category (soft delete by setting isActive to false)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.isActive = false;
    await category.save({ validateModifiedOnly: true });

    return res.status(200).json({
      success: true,
      message: "Category deactivated successfully",
      data: {
        category: {
          id: category._id,
          name: category.name,
          slug: category.slug,
          isActive: category.isActive,
        },
      },
    });
  } catch (error) {
    console.error("DeleteCategory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
