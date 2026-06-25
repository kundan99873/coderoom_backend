import { Request, Response } from "express";
import mongoose from "mongoose";
import Room from "../../schema/rooms.schema";
import RoomMember from "../../schema/roomMember.schema";
import RoomFile from "../../schema/roomFiles.schema";
import RoomJoinRequest from "../../schema/roomJoinRequest.schema";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { ApiResponse } from "../../utils/apiResponse";

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
    javascript: `// JavaScript — runs in browser sandbox
console.log("Printing numbers from 1 to 10:");
for (let i = 1; i <= 10; i++) {
  console.log(i);
}`,
    typescript: `// TypeScript — types are stripped, then run in browser
console.log("Printing numbers from 1 to 10:");
const numbers: number[] = Array.from({ length: 10 }, (_, i) => i + 1);
numbers.forEach((num: number) => {
  console.log(num);
});`,
    python: `# Python — runs in browser via Pyodide
print("Printing numbers from 1 to 10:")
for i in range(1, 11):
    print(i)`,
    go: `package main

import "fmt"

func main() {
    fmt.Println("Printing numbers from 1 to 10:")
    for i := 1; i <= 10; i++ {
        fmt.Println(i)
    }
}`,
    rust: `fn main() {
    println!("Printing numbers from 1 to 10:");
    for i in 1..=10 {
        println!("{}", i);
    }
}`,
    java: `class Main {
    public static void main(String[] args) {
        System.out.println("Printing numbers from 1 to 10:");
        for (int i = 1; i <= 10; i++) {
            System.out.println(i);
        }
    }
}`,
    cpp: `#include <iostream>

int main() {
    std::cout << "Printing numbers from 1 to 10:\\n";
    for (int i = 1; i <= 10; ++i) {
        std::cout << i << "\\n";
    }
    return 0;
}`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Playground</title>
</head>
<body>
  <h1>Numbers from 1 to 10:</h1>
  <ul id="numbers"></ul>
  <script>
    const ul = document.getElementById('numbers');
    for (let i = 1; i <= 10; i++) {
      const li = document.createElement('li');
      li.textContent = i;
      ul.appendChild(li);
    }
  </script>
</body>
</html>`,
  };
  return map[language] || "";
};

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const { name, language, isPublic } = req.body;

  const roomIdObj = new mongoose.Types.ObjectId();
  const shortId = roomIdObj.toString().slice(0, 8);
  const slugName = slugify(name) || "room";
  const customId = `${slugName}-${shortId}`;

  const room = await Room.create({
    _id: roomIdObj,
    name,
    language,
    isPublic,
    ownerId: req.user.id,
    customId,
  });

  await RoomMember.create({
    roomId: room._id,
    userId: req.user.id,
    role: "owner",
  });

  const lang = language || "javascript";
  const ext = getFileExtension(lang);
  const defaultFileName = lang === "java" ? "Main.java" : `index.${ext}`;
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
        role: "viewer",
      });
    }
  }

  return res.status(200).json(new ApiResponse("Room fetched successfully", {
    ...room.toObject(),
    userRole: isMember ? isMember.role : "viewer"
  }));
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

  // Lazy back-fill customId for rooms that don't have it
  for (const room of rooms as any[]) {
    if (!room.customId) {
      const slugName = slugify(room.name) || "room";
      const shortId = room._id.toString().slice(0, 8);
      room.customId = `${slugName}-${shortId}`;
      await room.save();
    }
  }

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