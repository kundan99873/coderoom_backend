import { Request, Response } from "express";
import RoomJoinRequest from "../../schema/roomJoinRequest.schema";
import RoomMember from "../../schema/roomMember.schema";
import Room from "../../schema/rooms.schema";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { ApiResponse } from "../../utils/apiResponse";

export const createJoinRequest = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const userId = req.user.id;

  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  // Check if already a member
  const existingMember = await RoomMember.findOne({ roomId, userId });
  if (existingMember) {
    throw new ApiError(400, "You are already a member of this room");
  }

  // If room is public, join directly
  if (room.isPublic) {
    const newMember = await RoomMember.create({
      roomId,
      userId,
      role: "viewer",
    });
    return res
      .status(201)
      .json(new ApiResponse("Joined room successfully", { membership: newMember }));
  }

  // If room is private, create join request
  // Check if a pending join request already exists
  const existingRequest = await RoomJoinRequest.findOne({
    roomId,
    userId,
    status: "pending",
  });

  if (existingRequest) {
    throw new ApiError(400, "You have a pending join request for this room");
  }

  const joinRequest = await RoomJoinRequest.create({
    roomId,
    userId,
    status: "pending",
  });

  // Emit event to owner/admin in the room
  const io = req.app.get("io");
  if (io) {
    io.to(`room:${roomId}`).emit("new-join-request", {
      roomId,
      userId,
    });
  }

  return res
    .status(201)
    .json(new ApiResponse("Join request submitted successfully", { joinRequest }));
});

export const getJoinRequests = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;

  // Check if requester is owner or admin
  const membership = await RoomMember.findOne({ roomId, userId: req.user.id });
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new ApiError(403, "Only owner or admin can view join requests");
  }

  const requests = await RoomJoinRequest.find({ roomId, status: "pending" })
    .populate("userId", "name email avatar");

  return res
    .status(200)
    .json(new ApiResponse("Join requests fetched successfully", requests));
});

export const handleJoinRequest = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const requestId = req.params.requestId as string;
  const { status } = req.body; // "approved" | "rejected"

  // Check if requester is owner or admin
  const membership = await RoomMember.findOne({ roomId, userId: req.user.id });
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new ApiError(403, "Only owner or admin can handle join requests");
  }

  const joinRequest = await RoomJoinRequest.findOne({ _id: requestId, roomId });
  if (!joinRequest) {
    throw new ApiError(404, "Join request not found");
  }

  if (joinRequest.status !== "pending") {
    throw new ApiError(400, `This request has already been ${joinRequest.status}`);
  }

  joinRequest.status = status;
  await joinRequest.save();

  if (status === "approved") {
    // Check if the user is already a member (concurrency safety)
    const alreadyMember = await RoomMember.findOne({
      roomId,
      userId: joinRequest.userId,
    });

    if (!alreadyMember) {
      await RoomMember.create({
        roomId,
        userId: joinRequest.userId,
        role: "viewer",
      });
    }
  }

  // Emit event to the requester
  const io = req.app.get("io");
  if (io) {
    const room = await Room.findById(roomId);
    io.to(`user:${joinRequest.userId}`).emit("join-request-handled", {
      roomId,
      customId: room?.customId || roomId,
      status,
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(`Join request ${status} successfully`, joinRequest));
});
