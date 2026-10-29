import express from "express";
import productRouter from "./routes/product.route.js";
import stockMovementRouter from "./routes/stockMovemnt.route.js";
import orderRouter from "./routes/order.route.js";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Stock Flow API is running",
  });
});

app.use("/api/products", productRouter);
app.use("/api/products", stockMovementRouter);
app.use("/api/order", orderRouter);

export default app;
