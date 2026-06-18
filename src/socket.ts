import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
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

  io.on("connection", (socket: Socket) => {
    const roomId = socket.handshake.query.roomId as string;
    const user = socket.data.user;

    if (!roomId || !user) {
      console.log("Disconnecting socket: missing roomId or user details");
      socket.disconnect(true);
      return;
    }

    // Join a personal channel for this user
    socket.join(`user:${user.id}`);

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
              role: "member",
            });
          }
        } 
        
        socket.join(`room:${roomId}`);
        socket.data.activeFileId = null;
        socket.data.isMember = true; // cache membership status

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
      // Check cached membership instead of querying DB on every character typed
      if (!socket.data.isMember) {
        socket.emit("error-msg", "Only room members can edit files");
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
