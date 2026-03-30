import mongoose, { Document, Schema, Model } from "mongoose";
import type { ShareKind, ShareVisibility, SharePreviewMode } from "@/types/share";

export interface IShare extends Document {
  ownerId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  kind: ShareKind;
  visibility: ShareVisibility;
  passwordHash: string | null;
  expiresAt: Date | null;
  currentVersionId: mongoose.Types.ObjectId | null;
  commentsEnabled: boolean;
  previewMode: SharePreviewMode;
  downloadEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShareSchema = new Schema<IShare>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    kind: {
      type: String,
      enum: ["pdf", "code", "image", "video", "audio", "text", "markdown", "data", "office", "archive", "binary"],
      required: true,
    },
    visibility: {
      type: String,
      enum: ["private", "public", "public_password"],
      default: "private",
    },
    passwordHash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    currentVersionId: { type: Schema.Types.ObjectId, default: null },
    commentsEnabled: { type: Boolean, default: true },
    previewMode: {
      type: String,
      enum: ["viewer", "viewer_comments", "download_only"],
      default: "viewer_comments",
    },
    downloadEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Share: Model<IShare> =
  (mongoose.models.Share as Model<IShare>) ??
  mongoose.model<IShare>("Share", ShareSchema);

export default Share;
