import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITeamMember extends Document {
  teamId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: "owner" | "member";
  createdAt: Date;
}

const teamMemberSchema = new Schema<ITeamMember>(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "member"],
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

// Make sure a user can only be in a team once
teamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });

const TeamMember: Model<ITeamMember> =
  mongoose.models.TeamMember ||
  mongoose.model<ITeamMember>("TeamMember", teamMemberSchema);

export default TeamMember;
