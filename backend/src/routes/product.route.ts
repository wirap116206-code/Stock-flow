import {Router} from "express"
import { createProduct, deleteProduct, getAllProducts, updateProduct } from "../controllers/product.controller.js"


const productRouter = Router()

productRouter.post("/", createProduct)
productRouter.get("/", getAllProducts)
productRouter.patch("/:id", updateProduct)
productRouter.delete("/:id", deleteProduct)



export default productRouter