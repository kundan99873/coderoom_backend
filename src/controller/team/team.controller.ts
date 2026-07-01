import mongoose from "mongoose";
import Team from "../../schema/team.schema";
import TeamMember from "../../schema/teamMember.schema";
import User from "../../schema/user.schema";
import Room from "../../schema/rooms.schema";
import { ApiError } from "../../utils/apiError";
import { ApiResponse } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

const createTeam = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const team = await Team.create({
    name,
    description,
    ownerId: req.user.id,
  });

  await TeamMember.create({
    teamId: team._id,
    userId: req.user.id,
    role: "owner",
  });

  return res
    .status(201)
    .json(new ApiResponse("Team created successfully", team));
});

const getUserTeams = asyncHandler(async (req, res) => {
  const memberships = await TeamMember.find({ userId: req.user.id }).populate({
    path: "teamId",
    populate: {
      path: "ownerId",
      select: "name email avatar",
    },
  });

  const teams = memberships
    .map((member) => member.teamId)
    .filter((team) => team !== null);

  return res
    .status(200)
    .json(new ApiResponse("User teams fetched successfully", teams));
});

const getTeamDetails = asyncHandler(async (req, res) => {
  const teamId = req.params.teamId as string;

  // Check if requesting user is a member of the team
  const isMember = await TeamMember.findOne({
    teamId,
    userId: req.user.id,
  });

  if (!isMember) {
    throw new ApiError(403, "You do not have access to this team");
  }

  const team = await Team.findById(teamId).populate("ownerId", "name email avatar");
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  const members = await TeamMember.find({ teamId }).populate("userId", "name email avatar");
  const rooms = await Room.find({ teamId }).populate("ownerId", "name email avatar");

  return res.status(200).json(
    new ApiResponse("Team details fetched successfully", {
      team,
      members,
      rooms,
      role: isMember.role,
    })
  );
});

const addTeamMember = asyncHandler(async (req, res) => {
  const teamId = req.params.teamId as string;
  const { email } = req.body;

  // Check if requesting user is the owner of the team
  const team = await Team.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  if (team.ownerId.toString() !== req.user.id) {
    throw new ApiError(403, "Only the team owner can add members");
  }

  // Find user by email
  const userToAdd = await User.findOne({ email });
  if (!userToAdd) {
    throw new ApiError(404, "User with this email does not exist");
  }

  // Check if already a member
  const existingMember = await TeamMember.findOne({
    teamId,
    userId: userToAdd._id,
  });

  if (existingMember) {
    throw new ApiError(400, "User is already a member of this team");
  }

  const newMember = await TeamMember.create({
    teamId,
    userId: userToAdd._id,
    role: "member",
  });

  return res
    .status(201)
    .json(new ApiResponse("Member added to team successfully", newMember));
});

const removeTeamMember = asyncHandler(async (req, res) => {
  const teamId = req.params.teamId as string;
  const userIdToRemove = req.params.userId as string;

  const team = await Team.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  const isOwner = team.ownerId.toString() === req.user.id;
  const isSelf = userIdToRemove === req.user.id;

  if (!isOwner && !isSelf) {
    throw new ApiError(403, "You do not have permission to remove this member");
  }

  const memberToRemove = await TeamMember.findOne({
    teamId,
    userId: userIdToRemove,
  });

  if (!memberToRemove) {
    throw new ApiError(404, "Member not found in team");
  }

  if (memberToRemove.role === "owner" && isOwner && isSelf) {
    throw new ApiError(400, "Team owner cannot leave the team. Delete the team instead.");
  }

  await TeamMember.findByIdAndDelete(memberToRemove._id);

  return res
    .status(200)
    .json(new ApiResponse("Member removed from team successfully"));
});

const deleteTeam = asyncHandler(async (req, res) => {
  const teamId = req.params.teamId as string;

  const team = await Team.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  if (team.ownerId.toString() !== req.user.id) {
    throw new ApiError(403, "Only the team owner can delete the team");
  }

  // Delete team, memberships, and dissociate rooms
  await Team.findByIdAndDelete(teamId);
  await TeamMember.deleteMany({ teamId });
  await Room.updateMany({ teamId }, { $unset: { teamId: "" } });

  return res
    .status(200)
    .json(new ApiResponse("Team and all associated memberships deleted successfully"));
});

export {
  createTeam,
  getUserTeams,
  getTeamDetails,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
};
