import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRoomMember extends Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: "owner" | "admin" | "member";
  createdAt: Date;
}

const roomMemberSchema = new Schema<IRoomMember>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// UNIQUE(room_id, user_id)
roomMemberSchema.index(
  { roomId: 1, userId: 1 },
  { unique: true }
);

const RoomMember: Model<IRoomMember> = mongoose.model<IRoomMember>(
  "RoomMember",
  roomMemberSchema
);

export default RoomMember;