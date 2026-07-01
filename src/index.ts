import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import corsConfig from "./config/cors.config";
import errorMiddleware from "./middleware/error.middleware";
import connectDB from "./config/dbConnection.config";
import authRouter from "./routes/auth.route";
import roomRouter from "./routes/room.route";
import teamRouter from "./routes/team.route";
import { initSocket } from "./socket";

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

const whitelist = [
  process.env.NODE_ENV === "development" ? "http://localhost:5173" : "",
  process.env.FRONTEND_URL,
]
  .filter((url): url is string => !!url)
  .map((url) => url.replace(/\/$/, ""));

const io = new Server(server, {
  cors: {
    origin: whitelist.length > 0 ? whitelist : "*",
    credentials: true,
  },
});

initSocket(io);
app.set("io", io);

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
app.use("/api", teamRouter);

const PORT = process.env.PORT || 3000;

app.use(errorMiddleware);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
