import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const adjustStock = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { type, qty, note } = req.body;
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid product ID.",
        },
      });
    }
    if (type !== "in" && type !== "out") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: 'Type must be either "in" or "out".',
        },
      });
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Quantity must be a positive integer.",
        },
      });
    }
    if (note !== undefined && note !== null && typeof note !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Note must be a string.",
        },
      });
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Product not found.",
        },
      });
    }
    const result = await prisma.$transaction(async (tx) => {
      let updatedProduct;

      if (type === "in") {
        updatedProduct = await tx.product.update({
          where: { id },
          data: {
            stock: { increment: qty },
          },
        });
      } else {
        const updated = await tx.product.updateMany({
          where: {
            id,
            stock: { gte: qty },
          },
          data: {
            stock: { decrement: qty },
          },
        });

        if (updated.count === 0) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        updatedProduct = await tx.product.findUniqueOrThrow({
          where: { id },
        });
      }

      await tx.stockMovement.create({
        data: {
          productId: id,
          type,
          qty,
          note: note ?? null,
        },
      });

      return updatedProduct;
    });
    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully.",
      data: {
        productId: result.id,
        sku: result.sku,
        name: result.name,
        type,
        qty,
        stockBefore: product.stock,
        stockAfter: result.stock,
        note: note ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return res.status(409).json({
        error: {
          code: "INSUFFICIENT_STOCK",
          message: "Insufficient stock.",
        },
      });
    }

    console.error("Failed to adjust stock:", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  }
};

export const getStockMovements = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid product ID.",
        },
      });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Product not found.",
        },
      });
    }

    const movements = await prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      data: movements,
    });
  } catch (error) {
    console.error("Failed to get stock movements:", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  }
};


