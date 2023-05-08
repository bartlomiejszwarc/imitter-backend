const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const userSchema = mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	displayName: { type: String, required: true, unique: false },
	profilePicture: { type: String, required: false },
	joinDate: { type: String, required: true },
	bio: { type: String, required: false },
	location: { type: String, required: false },
	followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});
userSchema.plugin(uniqueValidator);

module.exports = mongoose.model("User", userSchema);
