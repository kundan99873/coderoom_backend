import { Router } from "express";
import mongoose from "mongoose";
import Room from "../schema/rooms.schema";
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

// Resolve roomId parameter (either _id or customId) to the actual database ObjectId
router.param("roomId", async (req, res, next, roomId) => {
  try {
    const query: any = {};
    if (mongoose.Types.ObjectId.isValid(roomId)) {
      query.$or = [{ _id: roomId }, { customId: roomId }];
    } else {
      query.customId = roomId;
    }

    const room = await Room.findOne(query);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Lazy backfill customId if missing
    if (!room.customId) {
      const slugify = (text: string): string => {
        return text
          .toString()
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^\w\-]+/g, "")
          .replace(/\-\-+/g, "-")
          .replace(/^-+/, "")
          .replace(/-+$/, "");
      };
      const slugName = slugify(room.name) || "room";
      const shortId = room._id.toString().slice(0, 8);
      room.customId = `${slugName}-${shortId}`;
      await room.save();
    }

    // Standardize req.params.roomId as the true MongoDB ObjectId string
    req.params.roomId = room._id.toString();
    next();
  } catch (err) {
    next(err);
  }
});

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
