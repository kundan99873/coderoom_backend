import mongoose, { Schema, Model, HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface IUser {
  name: string;
  email: string;
  password?: string;

  avatar?: {
    publicId: string;
    url: string;
  };

  role: "user" | "admin";

  provider: "local" | "google";

  googleId?: string;

  isEmailVerified: boolean;

  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

  resetPasswordToken?: string;
  resetPasswordExpires?: Date;

  refreshToken?: string;

  lastLogin?: Date;
  loginAttempts?: Number;
  lockUntil?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^\S+@\S+\.\S+$/,
    },

    password: {
      type: String,
      minlength: 6,
      select: false,
    },

    avatar: {
      publicId: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
    },

    emailVerificationExpires: {
      type: Date,
    },

    resetPasswordToken: {
      type: String,
    },

    resetPasswordExpires: {
      type: Date,
    },

    refreshToken: {
      type: String,
      select: false,
    },

    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  const user = this as HydratedDocument<IUser>;

  if (!user.isModified("password") || !user.password) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  user.password = await bcrypt.hash(user.password, salt);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  const user = this as HydratedDocument<IUser>;

  if (!user.password) {
    return false;
  }

  return bcrypt.compare(candidatePassword, user.password);
};

userSchema.methods.generateAccessToken = function (): string {
  const user = this as HydratedDocument<IUser>;

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: (process.env.ACCESS_TOKEN_EXPIRES || "15m") as any,
    },
  );
};

userSchema.methods.generateRefreshToken = function (): string {
  const user = this as HydratedDocument<IUser>;

  return jwt.sign(
    {
      id: user._id,
    },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: (process.env.REFRESH_TOKEN_EXPIRES || "7d") as any,
    },
  );
};

userSchema.index({ email: 1 });

userSchema.index({
  emailVerificationToken: 1,
});

userSchema.index({
  resetPasswordToken: 1,
});

const User =
  (mongoose.models.User as UserModel) ||
  mongoose.model<IUser, UserModel>("User", userSchema);

export default User;
