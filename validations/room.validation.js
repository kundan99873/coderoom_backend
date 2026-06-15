"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleJoinRequestSchema = exports.updateFileContentSchema = exports.createFileSchema = exports.updateMemberRoleSchema = exports.addMemberSchema = exports.updateRoomSchema = exports.createRoomSchema = void 0;
const zod_1 = require("zod");
const createRoomSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Room name is required").max(100),
    language: zod_1.z.string().optional(),
    isPublic: zod_1.z.boolean().optional(),
});
exports.createRoomSchema = createRoomSchema;
const updateRoomSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Room name cannot be empty").max(100).optional(),
    language: zod_1.z.string().optional(),
    isPublic: zod_1.z.boolean().optional(),
});
exports.updateRoomSchema = updateRoomSchema;
const addMemberSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
});
exports.addMemberSchema = addMemberSchema;
const updateMemberRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(["admin", "member"]),
});
exports.updateMemberRoleSchema = updateMemberRoleSchema;
const createFileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "File name is required"),
    language: zod_1.z.string().optional(),
    content: zod_1.z.string().optional(),
});
exports.createFileSchema = createFileSchema;
const updateFileContentSchema = zod_1.z.object({
    content: zod_1.z.string(),
});
exports.updateFileContentSchema = updateFileContentSchema;
const handleJoinRequestSchema = zod_1.z.object({
    status: zod_1.z.enum(["approved", "rejected"]),
});
exports.handleJoinRequestSchema = handleJoinRequestSchema;
