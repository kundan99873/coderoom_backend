"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.changePasswordSchema = exports.loginUserSchema = exports.registerUserSchema = void 0;
const zod_1 = require("zod");
const registerUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
});
exports.registerUserSchema = registerUserSchema;
const loginUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    force_logout_device_id: zod_1.z.string().min(1).optional(),
});
exports.loginUserSchema = loginUserSchema;
const changePasswordSchema = zod_1.z.object({
    current_password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    new_password: zod_1.z.string().min(6, "New Password must be at least 6 characters"),
});
exports.changePasswordSchema = changePasswordSchema;
const resetPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
});
exports.resetPasswordSchema = resetPasswordSchema;
