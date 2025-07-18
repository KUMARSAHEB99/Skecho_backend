import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./src/routes/auth.js";
import productsRouter from "./src/routes/products.js";
import categoriesRouter from "./src/routes/categories.js";
import sellerRouter from "./src/routes/seller.js";
import cartRouter from "./src/routes/cart.js";
import userRouter from "./src/routes/user.js";
import customOrderRouter from "./src/routes/customOrders.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({limit: '50mb'}));

// Register routes
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/cart', cartRouter);
app.use("/api/user",userRouter);
app.use('/api/custom-orders',customOrderRouter);
app.use('/api/test',(req,res)=>{
  return res.status(200).json({ msg: "OK" });
}
);
app.listen(3000, () => {console.log("server is running on port 3000")});
