import mongoose, { Document, Schema, Model } from "mongoose";

export interface IReply {
  _id: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId | null;
  authorName: string;
  text: string;
  createdAt: Date;
}

export interface IComment extends Document {
  shareId: mongoose.Types.ObjectId;
  shareVersionId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId | null;
  authorName: string;
  text: string;
  target: {
    type: string;
    page?: number;
    selectedText?: string;
    highlightRects?: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      page?: number;
    }>;
    language?: string;
    lineStart?: number;
    lineEnd?: number;
  };
  resolved: boolean;
  replies: IReply[];
  createdAt: Date;
  updatedAt: Date;
}

const HighlightRectSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    page: { type: Number },
  },
  { _id: false }
);

const CommentTargetSchema = new Schema(
  {
    type: { type: String, required: true, enum: ["pdf", "code", "text", "general"] },
    page: { type: Number },
    selectedText: { type: String },
    highlightRects: [HighlightRectSchema],
    language: { type: String },
    lineStart: { type: Number },
    lineEnd: { type: Number },
  },
  { _id: false }
);

const ReplySchema = new Schema<IReply>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorName: { type: String, default: "Anonymous", trim: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const CommentSchema = new Schema<IComment>(
  {
    shareId: { type: Schema.Types.ObjectId, ref: "Share", required: true, index: true },
    shareVersionId: { type: Schema.Types.ObjectId, ref: "ShareVersion", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorName: { type: String, default: "Anonymous", trim: true },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    target: { type: CommentTargetSchema, required: true },
    resolved: { type: Boolean, default: false },
    replies: [ReplySchema],
  },
  { timestamps: true }
);

CommentSchema.index({ shareId: 1, shareVersionId: 1 });

const Comment: Model<IComment> =
  (mongoose.models.Comment as Model<IComment>) ??
  mongoose.model<IComment>("Comment", CommentSchema);

export default Comment;
