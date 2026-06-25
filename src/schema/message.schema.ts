import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessage extends Document {
  roomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index messages by roomId and creation time for quick history loading
messageSchema.index({ roomId: 1, createdAt: -1 });

const Message: Model<IMessage> = mongoose.model<IMessage>("Message", messageSchema);

export default Message;
