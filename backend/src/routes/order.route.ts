
import { Router } from "express";
import { cancelOrder, createOrder, getOrderById } from "../controllers/order.controller.js";

const orderRouter = Router();

orderRouter.post("/", createOrder);
orderRouter.get("/:id", getOrderById);
orderRouter.post("/:id/cancel", cancelOrder);

export default orderRouter;
