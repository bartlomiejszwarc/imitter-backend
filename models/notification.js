const mongoose = require("mongoose");

const notificationSchema = mongoose.Schema({
	//notification from User
	notificationFromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	//notification to User
	notificationOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	//notification text e.g "started following you"
	notificationText: { type: String, required: true },
	//notification type e.g `like`
	notificationType: { type: String, required: true },
	//notification subject e.g `/post/{{id}}`
	notificationSubject: { type: String, required: true },
	date: { type: Date, required: true },
	read: { type: Boolean, required: true },
});

module.exports = mongoose.model("Notification", notificationSchema);
