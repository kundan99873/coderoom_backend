import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISnippet extends Document {
  shortId: string;
  title: string;
  code: string;
  language: string;
  description?: string;
  authorId?: mongoose.Types.ObjectId;
  authorName: string;
  isPublic: boolean;
  views: number;
  forkedFrom?: string;
  createdAt: Date;
  updatedAt: Date;
}

const snippetSchema = new Schema<ISnippet>(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      default: "Untitled Snippet",
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      default: "javascript",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    authorName: {
      type: String,
      default: "Anonymous",
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    forkedFrom: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Snippet: Model<ISnippet> = mongoose.model<ISnippet>("Snippet", snippetSchema);

export default Snippet;
