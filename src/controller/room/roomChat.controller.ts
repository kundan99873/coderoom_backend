import { Request, Response } from "express";
import Message from "../../schema/message.schema";
import RoomMember from "../../schema/roomMember.schema";
import Room from "../../schema/rooms.schema";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { ApiResponse } from "../../utils/apiResponse";

// Helper to check room membership
const checkRoomMembership = async (roomId: string, userId: string) => {
  const membership = await RoomMember.findOne({ roomId, userId });
  if (membership) return membership;

  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  if (!room.isPublic) {
    throw new ApiError(403, "You do not have access to this room");
  }

  return null;
};

export const getRoomMessages = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;

  // Check access permission
  await checkRoomMembership(roomId, req.user.id);

  // Fetch last 100 messages
  const messages = await Message.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(100);

  // Return them in chronological order
  return res
    .status(200)
    .json(new ApiResponse("Room messages fetched successfully", messages.reverse()));
});
