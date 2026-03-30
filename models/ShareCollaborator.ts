import mongoose, { Document, Schema, Model } from "mongoose";
import type { CollaboratorRole } from "@/types/share";

export interface IShareCollaborator extends Document {
  shareId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: CollaboratorRole;
  createdAt: Date;
}

const ShareCollaboratorSchema = new Schema<IShareCollaborator>(
  {
    shareId: { type: Schema.Types.ObjectId, ref: "Share", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["viewer", "commenter", "editor"],
      default: "viewer",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ShareCollaboratorSchema.index({ shareId: 1, userId: 1 }, { unique: true });

const ShareCollaborator: Model<IShareCollaborator> =
  (mongoose.models.ShareCollaborator as Model<IShareCollaborator>) ??
  mongoose.model<IShareCollaborator>("ShareCollaborator", ShareCollaboratorSchema);

export default ShareCollaborator;
