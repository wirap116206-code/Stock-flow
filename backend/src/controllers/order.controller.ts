import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { customer, items } = req.body;

    if (typeof customer !== "string" || customer.trim() === "") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Customer is required.",
        },
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Items must be a non-empty array.",
        },
      });
    }

    for (const item of items) {
      if (typeof item.sku !== "string" || item.sku.trim() === "") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Each item must have a valid SKU.",
          },
        });
      }

      if (!Number.isInteger(item.qty) || item.qty <= 0) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Quantity must be a positive integer.",
          },
        });
      }
    }

    const skus = items.map((item) => item.sku.trim());

    if (new Set(skus).size !== skus.length) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Duplicate SKUs are not allowed.",
        },
      });
    }

    const products = await prisma.product.findMany({
      where: {
        sku: {
          in: skus,
        },
      },
    });

    if (products.length !== skus.length) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "One or more SKUs do not exist.",
        },
      });
    }

    const orderItems = items.map((item) => {
      const product = products.find((p) => p.sku === item.sku.trim())!;

      return {
        sku: product.sku,
        qty: item.qty,
        unitPrice: product.price,
      };
    });

    const total = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0,
    );

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.salesOrder.create({
        data: {
          customer: customer.trim(),
          total,
          status: "CREATED",
        },
      });

      for (const item of orderItems) {
        const result = await tx.product.updateMany({
          where: {
            sku: item.sku,
            stock: {
              gte: item.qty,
            },
          },
          data: {
            stock: {
              decrement: item.qty,
            },
          },
        });

        if (result.count === 0) {
          const product = await tx.product.findUnique({
            where: { sku: item.sku },
            select: { stock: true },
          });

          throw new Error(
            `INSUFFICIENT_STOCK:${item.sku}:${product?.stock ?? 0}`,
          );
        }
      }

      await tx.salesOrderItem.createMany({
        data: orderItems.map((item) => ({
          orderId: newOrder.id,
          sku: item.sku,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })),
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id: newOrder.id },
        include: {
          item: true,
        },
      });
    });

    return res.status(201).json({
      data: order,
    });
  } catch (error) {
    if (error instanceof Error) {
      const match = error.message.match(/^INSUFFICIENT_STOCK:(.+):(\d+)$/);

      if (match) {
        return res.status(409).json({
          error: {
            code: "INSUFFICIENT_STOCK",
            sku: match[1],
            available: Number(match[2]),
          },
        });
      }
    }

    console.error("Failed to create order:", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order ID.",
        },
      });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        item: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        error: {
          code: "ORDER_NOT_FOUND",
          message: "Order not found.",
        },
      });
    }

    return res.status(200).json({
      data: order,
    });
  } catch (error) {
    console.error("Failed to get order:", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order ID.",
        },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.updateMany({
        where: {
          id,
          status: "CREATED",
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      if (updated.count === 0) {
        const existingOrder = await tx.salesOrder.findUnique({
          where: { id },
          select: { status: true },
        });

        if (!existingOrder) {
          throw new Error("ORDER_NOT_FOUND");
        }

        throw new Error("ORDER_ALREADY_CANCELLED");
      }

      const order = await tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: {
          item: true,
        },
      });

      for (const item of order.item) {
        await tx.product.update({
          where: {
            sku: item.sku,
          },
          data: {
            stock: {
              increment: item.qty,
            },
          },
        });
      }

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: {
          item: true,
        },
      });
    });

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") {
        return res.status(404).json({
          error: {
            code: "ORDER_NOT_FOUND",
            message: "Order not found.",
          },
        });
      }

      if (error.message === "ORDER_ALREADY_CANCELLED") {
        return res.status(409).json({
          error: {
            code: "ORDER_ALREADY_CANCELLED",
            message: "Order has already been cancelled.",
          },
        });
      }
    }

    console.error("Failed to cancel order:", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  }
};
