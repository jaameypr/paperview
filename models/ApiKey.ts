import mongoose, { Document, Schema, Model } from "mongoose";

export interface IApiKey extends Document {
  userId: mongoose.Types.ObjectId;
  keyHash: string;
  keyPrefix: string;
  description: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    keyHash: { type: String, required: true, unique: true },
    keyPrefix: { type: String, required: true },
    description: { type: String, default: "", trim: true, maxlength: 200 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ApiKey: Model<IApiKey> =
  (mongoose.models.ApiKey as Model<IApiKey>) ??
  mongoose.model<IApiKey>("ApiKey", ApiKeySchema);

export default ApiKey;
