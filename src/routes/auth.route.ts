import { Router } from "express";
import {
  registerUserController,
  loginUserController,
  logoutUserController,
  getCurrentUserController,
} from "../controller/user/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import {
  registerUserSchema,
  loginUserSchema,
} from "../../validations/auth.validation";
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

export default router;
