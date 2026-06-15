import { UploadApiResponse } from "cloudinary";
import { uploadMediaToCloudinary } from "../../helper/uploadFileToCloudinary";
import User from "../../schema/user.schema";
import { ApiError } from "../../utils/apiError";
import { asyncHandler } from "../../utils/asyncHandler";
import crypto from "crypto";
import { ApiResponse } from "../../utils/apiResponse";
import {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  clearCookieOptions,
} from "../../config/cookies.config";

const registerUserController = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, "User with this email already exists");
  }

  const verifyToken: string = crypto.randomBytes(20).toString("hex");
  const verifyTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

  let imageData: UploadApiResponse | undefined = undefined;

  if (req.file) {
    try {
      const uploadResult = await uploadMediaToCloudinary(req.file, "users");
      imageData = uploadResult[0];
    } catch (error) {
      console.error("Error uploading avatar to Cloudinary:", error);
      throw new ApiError(500, "Failed to upload avatar");
    }
  }

  const newUser = {
    name,
    email,
    password,
    avatar: imageData
      ? {
          publicId: imageData.public_id,
          url: imageData.secure_url,
        }
      : undefined,
    isEmailVerified: true,
    emailVerificationToken: verifyToken,
    emailVerificationExpires: verifyTokenExpires,
  };

  const user = await User.create(newUser);

  return res.status(201).json(new ApiResponse("User registered successfully"));
});

const loginUserController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password +refreshToken");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      "Email not verified. Please verify your email to log in.",
    );
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  user.lastLogin = new Date();

  await user.save({ validateBeforeSave: false });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  return res
    .cookie("accessToken", accessToken, accessTokenCookieOptions)
    .cookie("refreshToken", refreshToken, refreshTokenCookieOptions)
    .status(200)
    .json(new ApiResponse("Login successful"));
});

const logoutUserController = asyncHandler(async (req, res) => {
  return res
    .clearCookie("accessToken", clearCookieOptions)
    .clearCookie("refreshToken", clearCookieOptions)
    .status(200)
    .json(new ApiResponse("Logout successful"));
});

const getCurrentUserController = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?.id).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return res.status(200).json(new ApiResponse("User profile fetched successfully", user));
});

export {
  registerUserController,
  loginUserController,
  logoutUserController,
  getCurrentUserController,
};
