
import cors, { type CorsOptions } from "cors";

const whitelist = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "https://codesroom.in",
  "https://www.codesroom.in",
]);

export const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return true;
  return whitelist.has(origin);
};

const corsOptions: CorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin || whitelist.has(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  maxAge: 86400, // Cache CORS preflight for 24 hours (avoids redundant OPTIONS requests)
};

const corsConfig = cors(corsOptions);

export default corsConfig;


