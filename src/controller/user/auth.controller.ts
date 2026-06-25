import { UploadApiResponse } from "cloudinary";
import { uploadMediaToCloudinary } from "../../helper/uploadFileToCloudinary";
import User from "../../schema/user.schema";
import { ApiError } from "../../utils/apiError";
import { asyncHandler } from "../../utils/asyncHandler";
import crypto from "crypto";
import { ApiResponse } from "../../utils/apiResponse";
import { sendEmail } from "../../helper/sendEmail";
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
  if (req.user?.id) {
    await User.findByIdAndUpdate(req.user.id, { $unset: { refreshToken: "" } });
  }
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

const forgotPasswordController = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User with this email does not exist");
  }

  const resetToken = crypto.randomBytes(20).toString("hex");
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = resetExpires;
  await user.save({ validateBeforeSave: false });

  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const message = `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
Please click on the following link, or paste this into your browser to complete the process:\n\n
${resetUrl}\n\n
If you did not request this, please ignore this email and your password will remain unchanged.\n`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #4f46e5; margin-bottom: 20px;">Password Reset Request</h2>
      <p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>
      <p>Please click the button below to reset your password. This link is valid for 1 hour.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Or copy and paste this URL into your browser:</p>
      <p style="word-break: break-all; color: #4f46e5; font-size: 14px;">${resetUrl}</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: "Coderoom - Password Reset Request",
    text: message,
    html,
  });

  return res.status(200).json(new ApiResponse("Password reset link sent to email"));
});

const resetPasswordController = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const tokenStr = typeof token === "string" ? token : req.body.token;
  const { password } = req.body;

  if (!tokenStr) {
    throw new ApiError(400, "Reset token is required");
  }

  const user = await User.findOne({
    resetPasswordToken: tokenStr,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, "Password reset token is invalid or has expired");
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  return res.status(200).json(new ApiResponse("Password has been reset successfully"));
});

const changePasswordController = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  const user = await User.findById(req.user?.id).select("+password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.password) {
    throw new ApiError(400, "This account does not have a local password set");
  }

  const isMatch = await user.comparePassword(current_password);
  if (!isMatch) {
    throw new ApiError(400, "Incorrect current password");
  }

  if (current_password === new_password) {
    throw new ApiError(400, "New password cannot be the same as your current password");
  }

  user.password = new_password;
  await user.save();

  return res.status(200).json(new ApiResponse("Password changed successfully"));
});

const googleAuthController = asyncHandler(async (req, res) => {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);
  return res.redirect(`${rootUrl}?${qs.toString()}`);
});

const googleLoginCallbackController = asyncHandler(async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    throw new ApiError(400, "Google authorization code is missing");
  }

  // Exchange code for tokens
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const values = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    grant_type: "authorization_code",
  };

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Google token exchange failed:", errorBody);
    throw new ApiError(500, "Failed to exchange code for token");
  }

  const { access_token } = await response.json();

  // Fetch user profile from Google userinfo API
  const userInfoUrl = `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`;
  const userResponse = await fetch(userInfoUrl);
  if (!userResponse.ok) {
    throw new ApiError(500, "Failed to fetch user info from Google");
  }

  const googleUser = await userResponse.json();
  const { sub: googleId, email, name, picture } = googleUser;

  // Find or create user
  let user = await User.findOne({
    $or: [{ googleId }, { email }],
  }).select("+refreshToken");

  if (!user) {
    // Register new user
    user = await User.create({
      name,
      email,
      googleId,
      provider: "google",
      isEmailVerified: true,
      avatar: picture ? { url: picture, publicId: "" } : undefined,
    });
  } else {
    // User exists. Update linking details
    let shouldSave = false;
    if (!user.googleId) {
      user.googleId = googleId;
      shouldSave = true;
    }
    if (user.provider !== "google") {
      user.provider = "google";
      shouldSave = true;
    }
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      shouldSave = true;
    }
    if (picture && (!user.avatar || !user.avatar.url)) {
      user.avatar = { url: picture, publicId: "" };
      shouldSave = true;
    }
    if (shouldSave) {
      await user.save({ validateBeforeSave: false });
    }
  }

  // Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

  // Set cookies and redirect
  res.cookie("accessToken", accessToken, accessTokenCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
  
  return res.redirect(`${frontendUrl}/dashboard`);
});

export {
  registerUserController,
  loginUserController,
  logoutUserController,
  getCurrentUserController,
  forgotPasswordController,
  resetPasswordController,
  changePasswordController,
  googleAuthController,
  googleLoginCallbackController,
};

