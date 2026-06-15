import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRoomJoinRequest extends Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

const roomJoinRequestSchema = new Schema<IRoomJoinRequest>(
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

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// UNIQUE(room_id, user_id, status)
roomJoinRequestSchema.index(
  {
    roomId: 1,
    userId: 1,
    status: 1,
  },
  {
    unique: true,
  }
);

const RoomJoinRequest: Model<IRoomJoinRequest> =
  mongoose.model<IRoomJoinRequest>(
    "RoomJoinRequest",
    roomJoinRequestSchema
  );

export default RoomJoinRequest; 