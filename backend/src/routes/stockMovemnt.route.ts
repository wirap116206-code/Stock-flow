
import { Router } from "express";
import { adjustStock, getStockMovements } from "../controllers/stockMovement.controller.js";

const stockMovementRouter = Router();

stockMovementRouter.post("/:id/stock", adjustStock);
stockMovementRouter.get("/:id/movements", getStockMovements);

export default stockMovementRouter;
