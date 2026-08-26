const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

// Create a new product
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      category,
      images,
      brand,
      rating,
      numReviews,
      isActive,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product description is required",
      });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: "Product price is required",
      });
    }

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a non-negative number",
      });
    }

    if (stock === undefined || stock === null) {
      return res.status(400).json({
        success: false,
        message: "Product stock is required",
      });
    }

    if (typeof stock !== "number" || stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a non-negative number",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Product category is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Category not found",
      });
    }

    if (rating !== undefined && (typeof rating !== "number" || rating < 0 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5",
      });
    }

    if (numReviews !== undefined && (typeof numReviews !== "number" || numReviews < 0)) {
      return res.status(400).json({
        success: false,
        message: "Number of reviews cannot be negative",
      });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description.trim(),
      price,
      stock,
      category,
      images: images || [],
      brand: brand ? brand.trim() : "",
      rating: rating || 0,
      numReviews: numReviews || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    await product.populate("category", "name slug");

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        product: {
          id: product._id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock: product.stock,
          category: product.category,
          images: product.images,
          brand: product.brand,
          rating: product.rating,
          numReviews: product.numReviews,
          isActive: product.isActive,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("CreateProduct Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// Get all products with filtering, sorting, and pagination
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      isActive,
      sort,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    const isAdmin = req.user && req.user.role === "admin";

    if (isAdmin && isActive !== undefined) {
      filter.isActive = isActive === "true";
    } else {
      filter.isActive = true;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: regex }, { description: regex }, { brand: regex }];
    }

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        const cat = await Category.findOne({ slug: category });
        if (cat) {
          filter.category = cat._id;
        } else {
          return res.status(200).json({
            success: true,
            data: {
              products: [],
              pagination: {
                page: pageNum,
                limit: limitNum,
                totalProducts: 0,
                totalPages: 0,
              },
            },
          });
        }
      }
    }

    if (brand && brand.trim()) {
      filter.brand = new RegExp(brand.trim(), "i");
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) {
        const min = parseFloat(minPrice);
        if (!isNaN(min) && min >= 0) {
          filter.price.$gte = min;
        }
      }
      if (maxPrice !== undefined) {
        const max = parseFloat(maxPrice);
        if (!isNaN(max) && max >= 0) {
          filter.price.$lte = max;
        }
      }
    }

    let sortOption = { createdAt: -1 };

    if (sort) {
      switch (sort) {
        case "price_asc":
          sortOption = { price: 1 };
          break;
        case "price_desc":
          sortOption = { price: -1 };
          break;
        case "newest":
          sortOption = { createdAt: -1 };
          break;
        case "rating":
          sortOption = { rating: -1 };
          break;
        default:
          sortOption = { createdAt: -1 };
      }
    }

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug")
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .select("-__v"),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalProducts / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalProducts,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("GetProducts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// Get a product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      isActive: true,
    })
      .populate("category", "name slug")
      .select("-__v");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    console.error("GetProductById Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// Update a product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const {
      name,
      description,
      price,
      stock,
      category,
      images,
      brand,
      rating,
      numReviews,
      isActive,
    } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot be empty",
        });
      }
      product.name = name.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({
          success: false,
          message: "Product description cannot be empty",
        });
      }
      product.description = description.trim();
    }

    if (price !== undefined) {
      if (typeof price !== "number" || price < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a non-negative number",
        });
      }
      product.price = price;
    }

    if (stock !== undefined) {
      if (typeof stock !== "number" || stock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock must be a non-negative number",
        });
      }
      product.stock = stock;
    }

    if (category !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
      product.category = category;
    }

    if (images !== undefined) {
      product.images = images;
    }

    if (brand !== undefined) {
      product.brand = brand.trim();
    }

    if (rating !== undefined) {
      if (typeof rating !== "number" || rating < 0 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 0 and 5",
        });
      }
      product.rating = rating;
    }

    if (numReviews !== undefined) {
      if (typeof numReviews !== "number" || numReviews < 0) {
        return res.status(400).json({
          success: false,
          message: "Number of reviews cannot be negative",
        });
      }
      product.numReviews = numReviews;
    }

    if (isActive !== undefined) {
      product.isActive = isActive;
    }

    await product.save();
    await product.populate("category", "name slug");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: {
        product: {
          id: product._id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock: product.stock,
          category: product.category,
          images: product.images,
          brand: product.brand,
          rating: product.rating,
          numReviews: product.numReviews,
          isActive: product.isActive,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("UpdateProduct Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// Delete a product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.isActive = false;
    await product.save({ validateModifiedOnly: true });

    return res.status(200).json({
      success: true,
      message: "Product deactivated successfully",
      data: {
        product: {
          id: product._id,
          name: product.name,
          isActive: product.isActive,
        },
      },
    });
  } catch (error) {
    console.error("DeleteProduct Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
