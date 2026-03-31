import mongoose, { Document, Schema, Model } from "mongoose";

export interface IShareVersion extends Document {
  shareId: mongoose.Types.ObjectId;
  versionNumber: number;
  createdByUserId: mongoose.Types.ObjectId;
  changeNote: string;
  contentType: string;
  originalFilename: string;
  storageKey: string;
  fileSize: number;
  checksum: string;
  metadata: Record<string, unknown>;
  restoredFromVersionId: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const ShareVersionSchema = new Schema<IShareVersion>(
  {
    shareId: { type: Schema.Types.ObjectId, ref: "Share", required: true, index: true },
    versionNumber: { type: Number, required: true, min: 1 },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changeNote: { type: String, default: "", trim: true, maxlength: 500 },
    contentType: { type: String, required: true },
    originalFilename: { type: String, required: true },
    storageKey: { type: String, required: true, unique: true },
    fileSize: { type: Number, required: true, min: 0 },
    checksum: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    restoredFromVersionId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ShareVersionSchema.index({ shareId: 1, versionNumber: 1 }, { unique: true });

const ShareVersion: Model<IShareVersion> =
  (mongoose.models.ShareVersion as Model<IShareVersion>) ??
  mongoose.model<IShareVersion>("ShareVersion", ShareVersionSchema);

export default ShareVersion;
