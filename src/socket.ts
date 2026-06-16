import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
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
      
      const token =
        cookies.accessToken ||
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication error: Token not provided"));
      }

      const decoded = jwt.verify(
        token as string,
        process.env.ACCESS_TOKEN_SECRET || "accessgdh56787$$%"
      ) as JwtPayload;

      const user = await User.findById(decoded.id).select("-password -refreshToken");
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
    } catch (error) {
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

    // Join room channel
    socket.on("join-room", async () => {
      try {
        const room = await Room.findById(roomId);
        if (!room) {
          socket.emit("error-msg", "Room not found");
          socket.disconnect(true);
          return;
        }

        const isMember = await RoomMember.findOne({ roomId, userId: user.id });
        if (!room.isPublic && !isMember) {
          socket.emit("error-msg", "You do not have access to this private room");
          socket.disconnect(true);
          return;
        }

        socket.join(`room:${roomId}`);
        socket.data.activeFileId = null;

        console.log(`Socket connection: User ${user.name} (${user.id}) joined room ${roomId}`);
        
        // Notify others and update the active user listing
        await broadcastActiveUsers(io, roomId);
      } catch (err) {
        console.error("Error joining room:", err);
        socket.emit("error-msg", "Internal server error during room joining");
      }
    });

    // Handle tracking which file is active for the user
    socket.on("active-file-change", async (fileId: string) => {
      socket.data.activeFileId = fileId;
      await broadcastActiveUsers(io, roomId);
    });

    // Handle character-level code changes
    socket.on("code-change", async (data: { fileId: string; content: string }) => {
      // Check if user is a member of the room (only members can write)
      const isMember = await RoomMember.findOne({ roomId, userId: user.id });
      if (!isMember) {
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
      await broadcastActiveUsers(io, roomId);
    });
  });
};

// Helper to broadcast active users list to the room
async function broadcastActiveUsers(io: Server, roomId: string) {
  const roomName = `room:${roomId}`;
  const sockets = await io.in(roomName).fetchSockets();

  const users = sockets.map((s) => ({
    socketId: s.id,
    id: s.data.user?.id,
    name: s.data.user?.name,
    email: s.data.user?.email,
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
