import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./src/routes/auth.js";
import productsRouter from "./src/routes/products.js";
import categoriesRouter from "./src/routes/categories.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Register routes
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);

app.listen(3000, () => {console.log("server is running on port 3000")});
