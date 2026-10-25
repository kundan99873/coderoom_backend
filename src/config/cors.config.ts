
import cors, { type CorsOptions } from "cors";

const whitelist = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://codesroom.in",
  "https://www.codesroom.in",
];

export const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return true;
  return whitelist.includes(origin);
};

const corsOptions: CorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};

const corsConfig = cors(corsOptions);

export default corsConfig;

