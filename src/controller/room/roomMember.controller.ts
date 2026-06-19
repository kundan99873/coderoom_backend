import { Request, Response } from "express";
import RoomMember from "../../schema/roomMember.schema";
import Room from "../../schema/rooms.schema";
import User from "../../schema/user.schema";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { ApiResponse } from "../../utils/apiResponse";

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const { email } = req.body;

  // Check if requesting user is owner or admin of the room
  const requesterMembership = await RoomMember.findOne({
    roomId,
    userId: req.user.id,
  });

  if (!requesterMembership || (requesterMembership.role !== "owner" && requesterMembership.role !== "admin")) {
    throw new ApiError(403, "Only owner or admin can add members to the room");
  }

  // Find user by email
  const userToAdd = await User.findOne({ email });
  if (!userToAdd) {
    throw new ApiError(404, "User with this email not found");
  }

  // Check if user is already a member
  const existingMember = await RoomMember.findOne({
    roomId,
    userId: userToAdd._id,
  });

  if (existingMember) {
    throw new ApiError(400, "User is already a member of this room");
  }

  const newMember = await RoomMember.create({
    roomId,
    userId: userToAdd._id,
    role: "viewer",
  });

  return res
    .status(201)
    .json(new ApiResponse("Member added successfully", newMember));
});

export const getRoomMembers = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;

  // Check if requesting user is a member of the room
  const requesterMembership = await RoomMember.findOne({
    roomId,
    userId: req.user.id,
  });

  if (!requesterMembership) {
    // If not a member, check if room is public.
    const room = await Room.findById(roomId);
    if (!room) {
      throw new ApiError(404, "Room not found");
    }
    if (!room.isPublic) {
      throw new ApiError(403, "You do not have permission to view members of this private room");
    }
  }

  const members = await RoomMember.find({ roomId }).populate("userId", "name email avatar");
  return res.status(200).json(new ApiResponse("Room members fetched successfully", members));
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const userId = req.params.userId as string;

  // Find the membership to remove
  const memberToRemove = await RoomMember.findOne({ roomId, userId });
  if (!memberToRemove) {
    throw new ApiError(404, "Member not found in this room");
  }

  // Check if the user is leaving themselves
  const isLeaving = req.user.id === userId;

  if (isLeaving) {
    if (memberToRemove.role === "owner") {
      throw new ApiError(400, "Owner cannot leave the room. Delete the room or transfer ownership first.");
    }
  } else {
    // Check if requester has authority
    const requesterMembership = await RoomMember.findOne({
      roomId,
      userId: req.user.id,
    });

    if (!requesterMembership) {
      throw new ApiError(403, "Access denied");
    }

    if (requesterMembership.role !== "owner" && requesterMembership.role !== "admin") {
      throw new ApiError(403, "Only owner or admin can remove others");
    }

    if (requesterMembership.role === "admin" && (memberToRemove.role === "admin" || memberToRemove.role === "owner")) {
      throw new ApiError(403, "Admins cannot remove other admins or the owner");
    }
  }

  await RoomMember.deleteOne({ _id: memberToRemove._id });

  return res.status(200).json(
    new ApiResponse(isLeaving ? "You have left the room" : "Member removed successfully")
  );
});

export const updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const userId = req.params.userId as string;
  const { role } = req.body;

  // Check if requester is the owner of the room
  const requesterMembership = await RoomMember.findOne({
    roomId,
    userId: req.user.id,
  });

  if (!requesterMembership || requesterMembership.role !== "owner") {
    throw new ApiError(403, "Only the owner can update roles");
  }

  const memberToUpdate = await RoomMember.findOne({ roomId, userId });
  if (!memberToUpdate) {
    throw new ApiError(404, "Member not found in this room");
  }

  if (memberToUpdate.role === "owner") {
    throw new ApiError(400, "Cannot change the role of the owner. Transfer ownership instead.");
  }

  memberToUpdate.role = role;
  await memberToUpdate.save();

  return res
    .status(200)
    .json(new ApiResponse("Member role updated successfully", memberToUpdate));
});