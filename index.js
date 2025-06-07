import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./src/routes/auth.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Register auth routes
app.use('/api/auth', authRouter);

app.listen(3000, () => {console.log("server is running on port 3000")});
