import { Router } from "express";
import {
  registerUserController,
  loginUserController,
  logoutUserController,
  getCurrentUserController,
  forgotPasswordController,
  resetPasswordController,
  changePasswordController,
} from "../controller/user/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import {
  registerUserSchema,
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validations/auth.validation";
import upload from "../middleware/image.middleware";

const router = Router();

router
  .route("/auth/register")
  .post(
    upload.single("avatar"),
    validate(registerUserSchema),
    registerUserController,
  );

router
  .route("/auth/login")
  .post(
    validate(loginUserSchema),
    loginUserController,
  );

router
  .route("/auth/logout")
  .post(authenticate, logoutUserController);

router
  .route("/auth/me")
  .get(authenticate, getCurrentUserController);

router
  .route("/auth/forgot-password")
  .post(
    validate(forgotPasswordSchema),
    forgotPasswordController,
  );

router
  .route("/auth/reset-password")
  .post(
    validate(resetPasswordSchema),
    resetPasswordController,
  );

router
  .route("/auth/change-password")
  .post(
    authenticate,
    validate(changePasswordSchema),
    changePasswordController,
  );

export default router;
