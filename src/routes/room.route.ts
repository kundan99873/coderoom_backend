import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createRoomSchema,
  updateRoomSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  createFileSchema,
  updateFileContentSchema,
  handleJoinRequestSchema,
} from "../validations/room.validation";
import {
  createRoom,
  getRoomById,
  getUserRooms,
  updateRoom,
  deleteRoom,
} from "../controller/room/room.controller";
import {
  addMember,
  getRoomMembers,
  removeMember,
  updateMemberRole,
} from "../controller/room/roomMember.controller";
import {
  createRoomFile,
  getRoomFiles,
  updateRoomFileContent,
  deleteRoomFile,
} from "../controller/room/roomFile.controller";
import {
  createJoinRequest,
  getJoinRequests,
  handleJoinRequest,
} from "../controller/room/roomJoinRequest.controller";

const router = Router();

// Room routes
router.post("/rooms", authenticate, validate(createRoomSchema), createRoom);
router.get("/rooms/my", authenticate, getUserRooms);
router.get("/rooms/:roomId", authenticate, getRoomById);
router.patch("/rooms/:roomId", authenticate, validate(updateRoomSchema), updateRoom);
router.delete("/rooms/:roomId", authenticate, deleteRoom);

// Member routes
router.post("/rooms/:roomId/members", authenticate, validate(addMemberSchema), addMember);
router.get("/rooms/:roomId/members", authenticate, getRoomMembers);
router.delete("/rooms/:roomId/members/:userId", authenticate, removeMember);
router.patch("/rooms/:roomId/members/:userId/role", authenticate, validate(updateMemberRoleSchema), updateMemberRole);

// File routes
router.post("/rooms/:roomId/files", authenticate, validate(createFileSchema), createRoomFile);
router.get("/rooms/:roomId/files", authenticate, getRoomFiles);
router.patch("/rooms/:roomId/files/:fileId", authenticate, validate(updateFileContentSchema), updateRoomFileContent);
router.delete("/rooms/:roomId/files/:fileId", authenticate, deleteRoomFile);

// Join request routes
router.post("/rooms/:roomId/join", authenticate, createJoinRequest);
router.get("/rooms/:roomId/join-requests", authenticate, getJoinRequests);
router.patch("/rooms/:roomId/join-requests/:requestId", authenticate, validate(handleJoinRequestSchema), handleJoinRequest);

export default router;
