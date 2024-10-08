import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoUrl: {
            type: String,
            required: true
        },
        thumbnail: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        duration: {
            type: Number,
            required: true,
        },
        viewsCount: {
            type: Number,
            required: true,
            default: 0
        },
        videoOwner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        isPublished: {
            type: Boolean,
            required: true
        }
    },
    {
        timestamps: true,
    }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const video = mongoose.model("Video", videoSchema);