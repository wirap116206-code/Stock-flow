import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { sku, name, price, stock, isActive } = req.body;
    if (
      typeof sku !== "string" ||
      !sku.trim() ||
      typeof name !== "string" ||
      !name.trim() ||
      !Number.isInteger(price) ||
      price <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "SKU, name, dan price harus valid.",
      });
    }

    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      return res.status(400).json({
        success: false,
        message: "Stock harus berupa bilangan bulat >= 0.",
      });
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive harus berupa boolean.",
      });
    }
    const newProduct = await prisma.product.create({
      data: {
        sku: sku.trim(),
        name: name.trim(),
        price,
        ...(stock !== undefined && { stock }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return res.status(201).json({
      success: true,
      message: "product created",
      data: newProduct,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "SKU already exists.",
      });
    }

    console.error("Failed to create product:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be >= 1 and limit must be between 1 and 100.",
      });
    }

    const where = search
      ? {
          OR: [
            { sku: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          movements: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              createdAt: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const formattedProducts = products.map((product) => {
      const { movements, ...productData } = product;

      return {
        ...productData,
        last_movement_at: movements[0]?.createdAt ?? null,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch products:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product Id",
      });
    }

    const product = await prisma.product.findUnique({
      where: {
        id: id,
      },
    });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "product not found",
      });
    }
  } catch (error) {
    console.error("Failed to fetch product: ", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product Id",
      });
    }
    const { sku, name, price, isActive } = req.body;

    if (
      sku == undefined &&
      name == undefined &&
      price == undefined &&
      isActive == undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one filed must be provided",
      });
    }
    if (sku !== undefined && (typeof sku !== "string" || !sku.trim())) {
      return res.status(400).json({
        success: false,
        message: "SKU must be a non-empty string.",
      });
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: "Name must be a non-empty string.",
      });
    }

    if (price !== undefined && (!Number.isInteger(price) || price <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Price must be a positive integer.",
      });
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean.",
      });
    }
    const existingProduct = await prisma.product.findUnique({
      where: {
        id,
      },
    });
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    const product = await prisma.product.update({
      where: {
        id,
      },
      data: {
        ...(sku !== undefined && { sku: sku.trim() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(price !== undefined && { price }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return res.status(200).json({
      success: true,
      message: "Product update successfully",
      data: product,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "SKU already exists.",
      });
    }

    console.error("Failed to update product:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        movements: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    if (product.movements.length > 0) {
      return res.status(409).json({
        success: false,
        code: "PRODUCT_HAS_HISTORY",
        message:
          "Product cannot be deleted because it has stock movement history.",
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete product:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
