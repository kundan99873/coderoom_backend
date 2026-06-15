import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import User from "../schema/user.schema";

interface JwtPayload {
  id: string;
  email: string;
  role: "user" | "admin";
}

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace("Bearer ", "") ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Authentication required. Token is missing.");
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET || "accessgdh56787$$%"
      ) as JwtPayload;

      const user = await User.findById(decoded.id).select("-password -refreshToken");
      if (!user) {
        throw new ApiError(401, "Invalid access token. User not found.");
      }

      req.user = {
        id: (user._id as any).toString(),
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      throw new ApiError(401, "Invalid or expired access token.");
    }
  }
);
