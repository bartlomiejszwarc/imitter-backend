const mongoose = require("mongoose");
//const User = require('../models/user')

const userPostSchema = mongoose.Schema({
	username: { type: String },
	displayName: { type: String },
	profilePicture: { type: String },
});

const postSchema = mongoose.Schema({
	text: { type: String, required: true },
	date: { type: Date, required: true },
	author: { type: userPostSchema, unique: false },
	likesCounter: { type: Number, required: false },
	imageUrl: { type: String, required: false },
	likedByIdArray: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	replies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
	isReply: { type: Boolean, required: true },
	originalPost: { type: String, required: true },
});

module.exports = mongoose.model("Post", postSchema);
