import { Request, Response } from "express";
import RoomFile from "../../schema/roomFiles.schema";
import RoomMember from "../../schema/roomMember.schema";
import Room from "../../schema/rooms.schema";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { ApiResponse } from "../../utils/apiResponse";

// Helper to check room membership
const checkRoomMembership = async (roomId: string, userId: string) => {
  const membership = await RoomMember.findOne({ roomId, userId });
  if (membership) return membership;

  // If not a member, check if room is public
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  if (!room.isPublic) {
    throw new ApiError(403, "You do not have access to this room");
  }

  return null;
};

export const createRoomFile = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const { name, language, content } = req.body;

  // Only members can create files
  const membership = await RoomMember.findOne({ roomId, userId: req.user.id });
  if (!membership) {
    throw new ApiError(403, "Only room members can create files");
  }

  // Check if filename is unique in the room
  const existingFile = await RoomFile.findOne({ roomId, name });
  if (existingFile) {
    throw new ApiError(400, "A file with this name already exists in the room");
  }

  // Find current max position to place new file at the end
  const lastFile = await RoomFile.findOne({ roomId }).sort({ position: -1 });
  const position = lastFile ? lastFile.position + 1 : 0;

  const file = await RoomFile.create({
    roomId,
    name,
    language: language || "javascript",
    content: content || "",
    position,
    createdBy: req.user.id,
  });

  return res
    .status(201)
    .json(new ApiResponse("File created successfully", file));
});

export const getRoomFiles = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;

  // Check access permission
  await checkRoomMembership(roomId, req.user.id);

  const files = await RoomFile.find({ roomId }).sort({ position: 1 });
  return res
    .status(200)
    .json(new ApiResponse("Room files fetched successfully", files));
});

export const updateRoomFileContent = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const fileId = req.params.fileId as string;
  const { content, name, language } = req.body;

  // Only members can update files
  const membership = await RoomMember.findOne({ roomId, userId: req.user.id });
  if (!membership) {
    throw new ApiError(403, "Only room members can edit files");
  }

  const updateData: any = {};
  if (content !== undefined) updateData.content = content;
  if (name !== undefined) {
    // Check if filename is unique in the room
    const existingFile = await RoomFile.findOne({ roomId, name, _id: { $ne: fileId } });
    if (existingFile) {
      throw new ApiError(400, "A file with this name already exists in the room");
    }
    updateData.name = name;
  }
  if (language !== undefined) updateData.language = language;

  const file = await RoomFile.findOneAndUpdate(
    { _id: fileId, roomId },
    updateData,
    { new: true }
  );

  if (!file) {
    throw new ApiError(404, "File not found");
  }

  return res
    .status(200)
    .json(new ApiResponse("File updated successfully", file));
});

export const deleteRoomFile = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const fileId = req.params.fileId as string;

  // Only members can delete files
  const membership = await RoomMember.findOne({ roomId, userId: req.user.id });
  if (!membership) {
    throw new ApiError(403, "Only room members can delete files");
  }

  const file = await RoomFile.findOneAndDelete({ _id: fileId, roomId });
  if (!file) {
    throw new ApiError(404, "File not found");
  }

  return res
    .status(200)
    .json(new ApiResponse("File deleted successfully"));
});
