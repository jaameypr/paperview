import mongoose, { Document, Schema, Model } from "mongoose";
import type { HighlightRect, Reply } from "@/types/comment";

export interface IReply {
  _id: mongoose.Types.ObjectId;
  author: string;
  text: string;
  createdAt: Date;
}

export interface IComment extends Document {
  author: string;
  page: number;
  text: string;
  quote?: string;
  highlightRects?: HighlightRect[];
  resolved: boolean;
  replies: IReply[];
  createdAt: Date;
  updatedAt: Date;
}

const HighlightRectSchema = new Schema<HighlightRect>(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    page: { type: Number },
  },
  { _id: false }
);

const ReplySchema = new Schema<IReply>(
  {
    author: { type: String, default: "Anonym", trim: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const CommentSchema = new Schema<IComment>(
  {
    author: { type: String, default: "Anonym", trim: true },
    page: {
      type: Number,
      required: [true, "Seite ist erforderlich"],
      min: [1, "Seite muss mindestens 1 sein"],
      validate: {
        validator: Number.isInteger,
        message: "Seite muss eine ganze Zahl sein",
      },
    },
    text: {
      type: String,
      required: [true, "Kommentartext ist erforderlich"],
      trim: true,
      minlength: [1, "Kommentartext darf nicht leer sein"],
    },
    quote: { type: String, trim: true },
    highlightRects: [HighlightRectSchema],
    resolved: { type: Boolean, default: false },
    replies: [ReplySchema],
  },
  { timestamps: true }
);

// Prevent model recompilation in development (hot reload)
const Comment: Model<IComment> =
  (mongoose.models.Comment as Model<IComment>) ??
  mongoose.model<IComment>("Comment", CommentSchema);

export default Comment;
