import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import User from "../schema/user.schema";
import { accessTokenCookieOptions } from "../config/cookies.config";

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

    const handleTokenRefresh = async () => {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        throw new ApiError(401, "Authentication required. Session expired.");
      }

      try {
        const decodedRefresh = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET || "gsahj76&^YHSUY*&"
        ) as { id: string };

        const user = await User.findById(decodedRefresh.id).select("+refreshToken");
        if (!user || user.refreshToken !== refreshToken) {
          throw new ApiError(401, "Invalid session. Please log in again.");
        }

        const newAccessToken = user.generateAccessToken();
        
        // Update the access token cookie on the response
        res.cookie("accessToken", newAccessToken, accessTokenCookieOptions);

        req.user = {
          id: (user._id as any).toString(),
          email: user.email,
          role: user.role,
        };

        next();
      } catch (refreshError) {
        throw new ApiError(401, "Session expired. Please log in again.");
      }
    };

    if (!token) {
      await handleTokenRefresh();
      return;
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
      // Access token verification failed (e.g. expired). Try to refresh.
      await handleTokenRefresh();
    }
  }
);

