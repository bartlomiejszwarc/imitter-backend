const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/user");
const multer = require("multer");
const { expressjwt: jwtcheck } = require("express-jwt");
const { default: mongoose } = require("mongoose");
const Post = require("../models/post");
const Notification = require("../models/notification");

//FOR IMAGE UPLOAD
const MIME_TYPE_MAP = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
};
const storage = multer.diskStorage({
	destination: (req, file, callback) => {
		callback(null, "../images");
	},
	filename: (req, file, callback) => {
		const name = file.originalname.toLowerCase().split(" ").join("-");
		const extension = MIME_TYPE_MAP[file.mimetype];
		callback(null, name + "-" + Date.now() + "." + extension);
	},
});

//CHECKING AUTH
const checkIfAuthenticated = jwtcheck({
	secret: process.env.SECRET,
	algorithms: ["HS256"],
});

//FUNCTION THAT COMPARES INSTANCE AUTHOR AND GIVEN USER, FOR EXAMPLE
const checkUser = function (instance, user, res) {
	if (instance !== user) {
		return false;
	} else {
		return true;
	}
};

//GETTING USER'S DATA BY ID
router.get("/api/userdata/:userId", (req, res, next) => {
	if (req.params.userId) {
		User.findById(req.params.userId)
			.then((userdata) => {
				res.status(200).json({
					message: "User found.",
					userdata: userdata,
				});
			})
			.catch((e) => {
				res.status(404).json({
					message: "User not found.",
				});
			});
	}
});

router.get(
	"/api/profile/:username",
	checkIfAuthenticated,
	async (req, res, next) => {
		const userdata = await User.findOne({ username: req.params.username }).then(
			(userdata) => {
				if (userdata) {
					res.status(200).json({
						message: "User found.",
						userdata: userdata,
					});
				} else {
					res.status(404).json({
						message: "User not found.",
					});
				}
			}
		);
	}
);

//PASSWORD CHANGE
router.put(
	"/api/profile/:username/password",
	checkIfAuthenticated,
	async (req, res, next) => {
		if (checkUser(req.body.newPassword, req.body.repeatNewPassword)) {
			bcrypt.hash(req.body.newPassword, 10).then((hash) => {
				User.findOneAndUpdate(
					{ username: req.body.username },
					{ password: hash }
				)
					.exec()
					.then(() => {
						res.status(200).json({
							message: "Password changed.",
						});
					});
			});
		} else {
			res.status(401).json({
				message: "User not found.",
			});
		}
	}
);

//ACCOUNT DELETE
router.delete("/api/users/:id/delete", async (req, res, next) => {
	try {
		const givenUserPassword = req.query.userPassword;
		User.findById(req.params.id).then((user) => {
			bcrypt.compare(
				givenUserPassword,
				user?.password,
				async function (err, result) {
					if (result) {
						await Post.deleteMany({ "author._id": req.params.id });
						await User.findOneAndDelete({ _id: req.params.id }).then(() => {
							res.status(200).json({
								message: "Password is valid. Account deleted.",
							});
						});
					} else {
						res.status(401).json({
							message: "Password is not valid.",
						});
					}
				}
			);
		});
	} catch (e) {
		res.status(401).json({
			message: "User not found.",
		});
	}
});

//UPDATING USER DATA
router.put(
	"/api/users/:id",
	checkIfAuthenticated,
	multer({ storage: storage }).single("profilePicture"),
	multer({ storage: storage }).single("backgroundImage"),
	(req, res, next) => {
		if (checkUser(req.params.id, req.body.id)) {
			User.findOneAndUpdate(
				{ _id: req.params.id },
				{
					$set: {
						displayName: req.body.displayName,
						bio: req.body.bio,
						location: req.body.location,
						profilePicture: req.body.profilePicture,
						backgroundImage: req.body.backgroundImage,
					},
				},
				function (err, response) {
					Post.updateMany(
						{ "author._id": req.params.id },
						{ "author.displayName": req.body.displayName }
					)
						.exec()
						.then(
							res.status(200).json({
								message: "User data updated",
							})
						);
				}
			);
		} else {
			res.status(401).json({
				message: "Unauthorized",
			});
		}
	}
);

router.put(
	"/api/users/:id/follow",
	checkIfAuthenticated,
	async (req, res, next) => {
		try {
			const result = await User.find({
				_id: req.params.id,
				followers: { $in: req.body.followedByUserId },
			});
			//UNFOLLOW USER
			if (result.length > 0) {
				await User.findOneAndUpdate(
					{ _id: req.params.id },
					{ $pullAll: { followers: [req.body.followedByUserId] } }
				);
				await User.findOneAndUpdate(
					{ _id: req.body.followedByUserId },
					{ $pullAll: { following: [req.params.id] } }
				);

				res.json({ userdata: result, message: "Unfollowed", followed: false });
			}
			//FOLLOW USER
			else {
				const user = await User.findById(req.body.followedByUserId);
				await User.findOneAndUpdate(
					{ _id: req.params.id },
					{ $push: { followers: req.body.followedByUserId } }
				);
				await User.findOneAndUpdate(
					{ _id: req.body.followedByUserId },
					{ $push: { following: [req.params.id] } }
				);
				await Notification.create({
					notificationFromUser: req.body.followedByUserId,
					notificationOwner: req.params.id,
					notificationText: "has started following you",
					notificationType: "follow",
					notificationSubject: "/profile/" + user.username,

					date: new Date(),
				});
				res.json({ userdata: result, message: "Followed", followed: true });
			}
			next();
		} catch (err) {
			next(err);
		}
	}
);

router.get(
	"/api/users/:id/notifications",
	checkIfAuthenticated,
	async (req, res) => {
		try {
			await Notification.find({ notificationOwner: req.params.id })
				.sort({ date: "desc" })
				.then((notification) => {
					res.status(200).json({
						notification: notification,
						message: "Notifications fetched.",
					});
				});
		} catch (e) {
			res.status(401).json({
				message: "Cannot get notifications",
			});
		}
	}
);

router.get(
	"/api/users/:username/following/top",
	checkIfAuthenticated,
	async (req, res, next) => {
		if (req.params.username !== "undefined") {
			try {
				const user = await User.find({ username: req.params.username })
					.select("following")
					.then(async function (users) {
						var usersdata = [];
						var usersFollowing = users[0].following;
						for (const u of usersFollowing) {
							const userData = await User.findById(u);
							usersdata.push(userData);
						}
						usersdata.sort((a, b) => b.followers.length - a.followers.length);
						usersdata = usersdata.slice(0, 3);
						return usersdata;
					})
					.then((usersdata) => {
						res.status(200).json({
							message: "User found",
							user: usersdata,
						});
					});
			} catch (error) {
				res.status(404).json({
					message: "User not found",
				});
			}
		}
	}
);

//Searching for users
router.get(
	"/api/search/users/:keyword",
	checkIfAuthenticated,
	async (req, res, next) => {
		try {
			await User.find({
				$or: [
					{ username: { $regex: req.params.keyword, $options: "i" } },
					{ displayName: { $regex: req.params.keyword, $options: "i" } },
				],
			}).then((users) => {
				res.status(200).json({
					message: "User found",
					users: users,
				});
			});
		} catch (error) {
			res.status(404).json({
				message: "User not found.",
			});
		}
	}
);

router.put("/api/users/:id/block", async (req, res, next) => {
	try {
		const result = await User.find({
			_id: req.body.blockedByUserId,
			blockedIds: { $in: req.params.id },
		});

		if (result.length === 0) {
			await User.findOneAndUpdate(
				{ _id: req.body.blockedByUserId },
				{
					$push: { blockedIds: req.params.id },
					$pullAll: { followers: [req.params.id] },
					$pullAll: { following: [req.params.id] },
				}
			);
			await User.findOneAndUpdate(
				{ _id: req.params.id },
				{
					$pullAll: { following: [req.body.blockedByUserId] },
					$pullAll: { followers: [req.body.blockedByUserId] },
				}
			).then(() => {
				res.status(200).json({
					message: "User data updated. User blocked",
				});
			});
		} else {
			await User.findOneAndUpdate(
				{ _id: req.body.blockedByUserId },
				{ $pullAll: { blockedIds: [req.params.id] } }
			).then(() => {
				res.status(200).json({
					message: "User data updated. User unblocked",
				});
			});
		}
	} catch (error) {
		res.status(404).json({
			message: "User not found.",
		});
	}
});

module.exports = router;
