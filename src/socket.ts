import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
import mongoose from "mongoose";
import User from "./schema/user.schema";
import RoomMember from "./schema/roomMember.schema";
import Room from "./schema/rooms.schema";

interface JwtPayload {
  id: string;
  email: string;
  role: "user" | "admin";
}

export const initSocket = (io: Server) => {
  // Authentication Middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const handshakeCookie = socket.handshake.headers.cookie;
      const cookies = handshakeCookie ? cookie.parse(handshakeCookie) : {};
      
      let token =
        cookies.accessToken ||
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      let userId: string | null = null;

      if (token) {
        if (typeof token === "string" && token.startsWith("Bearer ")) {
          token = token.replace("Bearer ", "");
        }
        try {
          const decoded = jwt.verify(
            token as string,
            process.env.ACCESS_TOKEN_SECRET || "accessgdh56787$$%"
          ) as JwtPayload;
          userId = decoded.id;
        } catch (jwtErr: any) {
          // Token is invalid/expired. Fallback to refreshToken.
        }
      }

      if (!userId) {
        const refreshToken = cookies.refreshToken;
        if (!refreshToken) {
          return next(new Error("Authentication error: Token not provided"));
        }

        try {
          const decodedRefresh = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET || "gsahj76&^YHSUY*&"
          ) as { id: string };

          const user = await User.findById(decodedRefresh.id).select("+refreshToken");
          if (!user) {
            return next(new Error("Authentication error: Invalid session"));
          }
          if (user.refreshToken !== refreshToken) {
            return next(new Error("Authentication error: Invalid session"));
          }
          userId = (user._id as any).toString();
        } catch (refreshErr: any) {
          return next(new Error("Authentication error: Invalid or expired token"));
        }
      }

      const user = await User.findById(userId).select("-password -refreshToken");
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      // Attach user details to socket data
      socket.data.user = {
        id: (user._id as any).toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error: any) {
      console.error("Socket authentication failed:", error);
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const initialRoomId = socket.handshake.query.roomId as string;
    const user = socket.data.user;

    if (!user) {
      console.log("Disconnecting socket: missing user details");
      socket.disconnect(true);
      return;
    }

    // Join a personal channel for this user
    socket.join(`user:${user.id}`);

    if (!initialRoomId) {
      console.log(`Socket connection: User ${user.name} (${user.id}) connected (global/no room)`);
      return;
    }

    // Resolve initialRoomId to the actual database roomId (ObjectId string)
    let roomId = initialRoomId;
    try {
      const query: any = {};
      if (mongoose.Types.ObjectId.isValid(initialRoomId)) {
        query.$or = [{ _id: initialRoomId }, { customId: initialRoomId }];
      } else {
        query.customId = initialRoomId;
      }

      const room = await Room.findOne(query);
      if (!room) {
        console.log(`Disconnecting socket: Room not found for query roomId: ${initialRoomId}`);
        socket.emit("error-msg", "Room not found");
        socket.disconnect(true);
        return;
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

      roomId = room._id.toString();
    } catch (err) {
      console.error("Socket error during roomId resolution:", err);
      socket.emit("error-msg", "Authentication error: invalid room ID format");
      socket.disconnect(true);
      return;
    }

    // Join room channel
    socket.on("join-room", async () => {
      try {
        const room = await Room.findById(roomId);
        if (!room) {
          socket.emit("error-msg", "Room not found");
          socket.disconnect(true);
          return;
        }

        let isMember = await RoomMember.findOne({ roomId, userId: user.id });
        if (!isMember) {
          if (!room.isPublic) {
            // Keep connection open so they can receive real-time approval, but don't join the room
            socket.emit("join-request-status", { status: "pending" });
            return;
          } else {
            isMember = await RoomMember.create({
              roomId: room._id,
              userId: user.id,
              role: "viewer",
            });
          }
        } 
        
        socket.join(`room:${roomId}`);
        socket.data.activeFileId = null;
        socket.data.isMember = true; // cache membership status
        socket.data.role = isMember.role; // cache user role

        console.log(`Socket connection: User ${user.name} (${user.id}) joined room ${roomId}`);
        
        // Notify others and update the active user listing
        socket.to(`room:${roomId}`).emit("user-joined", {
          id: user.id,
          name: user.name,
          email: user.email,
        });
        await broadcastActiveUsers(io, roomId);
      } catch (err) {
        console.error("Error joining room:", err);
        socket.emit("error-msg", "Internal server error during room joining");
        socket.disconnect(true);
      }
    });

    // Handle tracking which file is active for the user
    socket.on("active-file-change", async (fileId: string) => {
      socket.data.activeFileId = fileId;
      await broadcastActiveUsers(io, roomId);
    });

    // Handle character-level code changes
    socket.on("code-change", async (data: { fileId: string; content: string }) => {
      // Check cached role instead of querying DB on every character typed
      const role = socket.data.role;
      if (role !== "owner" && role !== "editor") {
        socket.emit("error-msg", "You do not have permission to edit files in this room");
        return;
      }

      // Broadcast changes to all other sockets in the room
      socket.to(`room:${roomId}`).emit("code-update", {
        fileId: data.fileId,
        content: data.content,
        senderId: socket.id,
        userId: user.id,
      });
    });

    // Handle user cursors synchronization
    socket.on("cursor-move", (data: { fileId: string; position: { lineNumber: number; column: number } | null }) => {
      socket.to(`room:${roomId}`).emit("cursor-update", {
        userId: user.id,
        userName: user.name,
        fileId: data.fileId,
        position: data.position,
        senderId: socket.id,
      });
    });

    // Handle file sync events (create, delete, rename)
    socket.on("file-event", (data: { action: "create" | "rename" | "delete"; fileId?: string; file?: any }) => {
      const role = socket.data.role;
      if (role !== "owner" && role !== "editor") {
        socket.emit("error-msg", "You do not have permission to perform this file operation");
        return;
      }
      socket.to(`room:${roomId}`).emit("file-update", data);
    });

    // Disconnection
    socket.on("disconnect", async () => {
      console.log(`Socket disconnection: User ${user.name} left room ${roomId}`);
      if (socket.data.isMember) {
        socket.to(`room:${roomId}`).emit("user-left", {
          id: user.id,
          name: user.name,
        });
      }
      await broadcastActiveUsers(io, roomId);
    });
  });
};

// Helper to broadcast active users list to the room
async function broadcastActiveUsers(io: Server, roomId: string) {
  const roomName = `room:${roomId}`;
  const sockets = await io.in(roomName).fetchSockets();

  const users = sockets
    .filter((s) => s.data && s.data.user)
    .map((s) => ({
      socketId: s.id,
      id: s.data.user.id,
      name: s.data.user.name,
      email: s.data.user.email,
      activeFileId: s.data.activeFileId || null,
    }));

  // Deduplicate active users by user ID
  const uniqueUsersMap = new Map<string, typeof users[0]>();
  for (const u of users) {
    if (u.id) {
      uniqueUsersMap.set(u.id, u);
    }
  }
  const uniqueUsers = Array.from(uniqueUsersMap.values());

  io.to(roomName).emit("room-users", {
    users: uniqueUsers,
    count: uniqueUsers.length,
  });
}
