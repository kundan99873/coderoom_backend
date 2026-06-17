import { Request, Response } from "express";
import Room from "../../schema/rooms.schema";
import RoomMember from "../../schema/roomMember.schema";
import RoomFile from "../../schema/roomFiles.schema";
import RoomJoinRequest from "../../schema/roomJoinRequest.schema";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { ApiResponse } from "../../utils/apiResponse";

const getFileExtension = (language: string): string => {
  const map: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    go: "go",
    rust: "rs",
    java: "java",
    cpp: "cpp",
    csharp: "cs",
    php: "php",
    ruby: "rb",
    bash: "sh",
    html: "html",
    css: "css",
    sql: "sql",
    json: "json",
  };
  return map[language] || "txt";
};

const getDefaultContent = (language: string): string => {
  const map: Record<string, string> = {
    javascript: "// JavaScript — runs in browser sandbox\nconsole.log('Hello, World!');",
    typescript: "// TypeScript — types are stripped, then run in browser\nconst greeting: string = 'Hello, World!';\nconsole.log(greeting);",
    python: "# Python — runs in browser via Pyodide\nprint('Hello, World!')",
    go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello, World!\")\n}",
    rust: "fn main() {\n    println!(\"Hello, World!\");\n}",
    java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}",
    cpp: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, World!\\n\";\n    return 0;\n}",
    html: "<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"utf-8\">\n  <title>Playground</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>",
  };
  return map[language] || "";
};

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const { name, language, isPublic } = req.body;

  const room = await Room.create({
    name,
    language,
    isPublic,
    ownerId: req.user.id,
  });

  await RoomMember.create({
    roomId: room._id,
    userId: req.user.id,
    role: "owner",
  });

  const lang = language || "javascript";
  const ext = getFileExtension(lang);
  const defaultFileName = `index.${ext}`;
  const defaultContent = getDefaultContent(lang);

  await RoomFile.create({
    roomId: room._id,
    name: defaultFileName,
    language: lang,
    content: defaultContent,
    position: 0,
    createdBy: req.user.id,
  });

  return res
    .status(201)
    .json(new ApiResponse("Room created successfully", room));
});

export const getRoomById = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;

  const room = await Room.findById(roomId).populate("ownerId", "name email avatar");
  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  // Check if requesting user is already a member of the room
  const isMember = await RoomMember.findOne({
    roomId,
    userId: req.user.id,
  });

  if (!isMember) {
    // If the room is private, check if the user is a member of the room
    if (!room.isPublic) {
      // Check if they have a pending/rejected join request
      const joinRequest = await RoomJoinRequest.findOne({
        roomId,
        userId: req.user.id,
      }).sort({ createdAt: -1 });

      const requestStatus = joinRequest ? joinRequest.status : "idle";

      throw new ApiError(403, "You do not have permission to view this room", {
        isPrivate: true,
        requestStatus,
      });
    } else {
      // Auto-join the public room
      await RoomMember.create({
        roomId: room._id,
        userId: req.user.id,
        role: "member",
      });
    }
  }

  return res.status(200).json(new ApiResponse("Room fetched successfully", room));
});

export const getUserRooms = asyncHandler(async (req: Request, res: Response) => {
  // Find all memberships for this user, populate room
  const memberships = await RoomMember.find({ userId: req.user.id }).populate({
    path: "roomId",
    populate: {
      path: "ownerId",
      select: "name email avatar",
    },
  });

  // Extract rooms from memberships
  const rooms = memberships
    .map((member) => member.roomId)
    .filter((room) => room !== null);

  return res
    .status(200)
    .json(new ApiResponse("User rooms fetched successfully", rooms));
});

export const updateRoom = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const { name, language, isPublic } = req.body;

  // Check if requesting user is owner or admin in this room
  const membership = await RoomMember.findOne({
    roomId,
    userId: req.user.id,
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new ApiError(403, "Only owner or admin can update room details");
  }

  const updatedRoom = await Room.findByIdAndUpdate(
    roomId,
    { name, language, isPublic },
    { new: true, runValidators: true }
  );

  if (!updatedRoom) {
    throw new ApiError(404, "Room not found");
  }

  return res
    .status(200)
    .json(new ApiResponse("Room updated successfully", updatedRoom));
});

export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;

  // Check if requesting user is the owner of the room
  const membership = await RoomMember.findOne({
    roomId,
    userId: req.user.id,
  });

  if (!membership || membership.role !== "owner") {
    throw new ApiError(403, "Only the owner can delete the room");
  }

  const deletedRoom = await Room.findByIdAndDelete(roomId);
  if (!deletedRoom) {
    throw new ApiError(404, "Room not found");
  }

  // Clean up members, files, and join requests
  await RoomMember.deleteMany({ roomId });
  await RoomFile.deleteMany({ roomId });
  await RoomJoinRequest.deleteMany({ roomId });

  return res
    .status(200)
    .json(new ApiResponse("Room and all associated resources deleted successfully"));
});