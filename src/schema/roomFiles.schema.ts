import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRoomFile extends Document {
  roomId: mongoose.Types.ObjectId;
  name: string;
  language: string;
  content: string;
  position: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roomFileSchema = new Schema<IRoomFile>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    language: {
      type: String,
      default: "javascript",
    },

    content: {
      type: String,
      default: "",
    },

    position: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// UNIQUE(room_id, name)
roomFileSchema.index(
  { roomId: 1, name: 1 },
  { unique: true }
);

const RoomFile: Model<IRoomFile> = mongoose.model<IRoomFile>(
  "RoomFile",
  roomFileSchema
);

export default RoomFile;