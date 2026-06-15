import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import corsConfig from "./config/cors.config";
import errorMiddleware from "./middleware/error.middleware";
import connectDB from "./config/dbConnection.config";
import authRouter from "./routes/auth.route";
import roomRouter from "./routes/room.route";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(corsConfig);
app.use(morgan("dev"));
app.use(cookieParser());
app.use(compression());

connectDB()
  .then(() => {
    console.log("Database connection established successfully.");
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  });

app.get("/", (_req, res) => {
  res.json({ message: "Hello TypeScript Backend" });
});

app.use("/api", authRouter);
app.use("/api", roomRouter);

const PORT = process.env.PORT || 3000;

app.use(errorMiddleware);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
