import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRoom extends Document {
  name: string;
  language: string;
  code: string;
  isPublic: boolean;
  ownerId: mongoose.Types.ObjectId;
  customId: string;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    customId: {
      type: String,
      unique: true,
      sparse: true,
    },

    language: {
      type: String,
      default: "javascript",
    },

    code: {
      type: String,
      default: "",
    },

    isPublic: {
      type: Boolean,
      default: true,
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Room: Model<IRoom> = mongoose.model<IRoom>("Room", roomSchema);

export default Room;