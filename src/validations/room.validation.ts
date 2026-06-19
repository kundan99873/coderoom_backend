import { z } from "zod";

const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100),
  language: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const updateRoomSchema = z.object({
  name: z.string().min(1, "Room name cannot be empty").max(100).optional(),
  language: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

const createFileSchema = z.object({
  name: z.string().min(1, "File name is required"),
  language: z.string().optional(),
  content: z.string().optional(),
});

const updateFileContentSchema = z.object({
  content: z.string().optional(),
  name: z.string().min(1, "File name cannot be empty").optional(),
  language: z.string().optional(),
});

const handleJoinRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export {
  createRoomSchema,
  updateRoomSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  createFileSchema,
  updateFileContentSchema,
  handleJoinRequestSchema,
};
