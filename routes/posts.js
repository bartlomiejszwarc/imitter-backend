const express = require("express");
const { expressjwt: jwt } = require("express-jwt");
const mongoose = require("mongoose");
const Post = require("../models/post");
const User = require("../models/user");
const checkAuth = require("../middleware/check-auth");
const Notification = require("../models/notification");

const checkIfAuthenticated = jwt({
	secret: process.env.SECRET,
	algorithms: ["HS256"],
});

const router = express.Router();
const multer = require("multer");

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

//POST
router.post(
	"/api/posts",
	checkIfAuthenticated,
	multer({ storage: storage }).single("image"),
	async (req, res, next) => {
		const id = new mongoose.Types.ObjectId();
		const post = new Post({
			_id: id,
			text: req.body.text,
			date: req.body.date,
			imageUrl: req.body.image,
			author: req.body.author,
			likesCounter: req.body.likesCounter,
			isReply: false,
			originalPost: id,
		});
		await post.save();
		res.status(201).json({
			message: "Post added successfully",
		});
	}
);

//FETCHING POSTS
router.get("/api/posts/:id", checkIfAuthenticated, async (req, res, next) => {
	const user = await User.find({ _id: req.params.id });

	const blockedByUsers = await User.find({
		blockedIds: { $in: req.params.id },
	});
	Post.find({
		allowDiskUse: true,
		isReply: false,
		$and: [
			{ "author._id": { $nin: user[0].blockedIds } },
			{ "author._id": { $nin: blockedByUsers } },
		],
	})
		.sort({ date: -1 })

		.then((documents) => {
			res.status(200).json({
				message: "Post fetched succesfully!",
				posts: documents,
			});
		});
});
router.get(
	"/api/posts/following/:id",
	checkIfAuthenticated,
	async (req, res, next) => {
		const user = await User.find({ _id: req.params.id }).exec();
		const following = user[0].following;

		Post.find({
			"author._id": { $in: following },
		})
			.sort("-date")
			.then((posts) => {
				res.status(200).json({
					posts: posts,
					message: "Post found successfully",
				});
			});
	}
);

//FETCHING USER'S POST FOR USER'S PROFILE
router.get("/api/users/:id/posts", checkIfAuthenticated, (req, res, next) => {
	var userPosts = Post.find({ "author._id": req.params.id });
	userPosts
		.sort("-date")
		.exec()
		.then((documents) => {
			res.status(200).json({
				message: "Users posts fetched succesfully.",
				posts: documents,
			});
		})
		.catch(function (err) {
			res.status(404).json({
				message: "User not found.",
			});
		});
});
//FETCHING USER'S LIKED POSTS FOR USER'S PROFILE
router.get("/api/users/:id/likes", checkIfAuthenticated, (req, res, next) => {
	Post.find({ likedByIdArray: { $in: req.params.id } })
		.sort("-date")
		.then((likedPosts) => {
			res.status(200).json({
				posts: likedPosts,
			});
		});
});

const checkUser = function (instance, user, res) {
	if (instance !== user) {
		return false;
	} else {
		return true;
	}
};

async function deletePostAndReplies(postId) {
	const post = await Post.findById(postId);

	if (!post) {
		return;
	}

	for (const replyId of post.replies) {
		await deletePostAndReplies(replyId);
	}

	if (post.isReply && post.originalPost) {
		const parentPost = await Post.findById(post.originalPost);
		if (parentPost) {
			parentPost.replies = parentPost.replies.filter(
				(reply) => reply.toString() !== postId.toString()
			);
			await parentPost.save();
		}
	}

	await post.delete();
}

router.delete(
	"/api/posts/:id",
	checkIfAuthenticated,
	async (req, res, next) => {
		const postToBeDeleted = await Post.findById(req.params.id);

		if (!postToBeDeleted) {
			return res.status(404).json({
				message: "Post not found.",
			});
		}

		const postAuthorId = postToBeDeleted.author._id.valueOf();
		const userId = req.body.userId;

		if (checkUser(postAuthorId, userId)) {
			await deletePostAndReplies(postToBeDeleted._id);
			res.status(200).json({
				message: "Post and its replies deleted successfully. User authorized.",
			});
		} else {
			res.status(401).json({
				message: "User unauthorized.",
			});
		}
	}
);

//GETTING POST DETAILS
router.get("/api/posts/details/:id", async (req, res, next) => {
	await Post.findById({ _id: req.params.id })
		.then((document) => {
			res.status(200).json({
				message: "Post found",
				post: document,
			});
		})
		.catch((err) => {
			res.status(404).json({
				message: "Post not found",
			});
		});
});

//UPDATING POST REPLIES ARRAY
router.put("/api/posts/:id/replies", async (req, res, next) => {
	const reply = new Post({
		id: new mongoose.Types.ObjectId(),
		text: req.body.text,
		date: req.body.date,
		imageUrl: req.body.image,
		author: req.body.author,
		likesCounter: req.body.likesCounter,
		isReply: true,
		originalPost: req.params.id,
	});

	const originalPostAuthor = await Post.findOne({ _id: req.params.id })
		.select("author")
		.exec();
	reply.save();

	if (reply.author._id.valueOf() !== originalPostAuthor.author._id.valueOf()) {
		// let checkNotification = await Notification.find({
		// 	$and: [
		// 		{ notificationFromUser: reply.author._id },
		// 		{ notificationOwner: originalPostAuthor.author._id },
		// 		{ notificationType: "reply" },
		// 	],
		// });
		// if (checkNotification) {
		// await Notification.findOneAndDelete({
		// 	$and: [
		// 		{ notificationFromUser: reply.author._id },
		// 		{ notificationOwner: originalPostAuthor.author._id },
		// 		{ notificationType: "reply" },
		// 	],
		// });
	}
	await Notification.create({
		notificationFromUser: reply.author._id,
		notificationOwner: originalPostAuthor.author._id,
		notificationText: "replied to your post",
		notificationType: "reply",
		notificationSubject:
			"/profile/" + originalPostAuthor.author.username + "/status/" + reply.id,
		date: new Date(),
		read: false,
	});
	//}
	Post.findByIdAndUpdate(
		req.params.id,
		{
			$push: { replies: reply },
		},
		{ new: true }
	)
		.exec()
		.then((document) => {
			res.status(200).json({
				post: document,
				message: "Reply added successfully. User authorized.",
			});
		});
});

router.put("/api/posts/:id", checkIfAuthenticated, (req, res, next) => {
	Post.find(
		{ _id: req.params.id, likedByIdArray: { $in: req.body.userId } },
		async function (err, result) {
			const postAuthor = await Post.findOne({ _id: req.params.id })
				.select("author")
				.exec();
			if (req.body.userId !== undefined && req.body.userId !== null) {
				if (result.length > 0) {
					//DECREASING LIKES COUNTER
					await Post.findOneAndUpdate(
						{ _id: req.params.id },
						{
							$pullAll: { likedByIdArray: [req.body.userId] },
							$inc: { likesCounter: -1 },
						}
					).then((result) => {
						res
							.status(200)
							.json({ message: "Post updated", post: result, liked: false });
					});
				} else {
					//INCREASING LIKES COUNTER
					if (req.body.userId !== postAuthor.author._id.valueOf()) {
						let checkNotification = await Notification.find({
							$and: [
								{ notificationFromUser: req.body.userId },
								{ notificationOwner: postAuthor.author._id },
								{ notificationType: "like" },
							],
						});
						if (checkNotification) {
							await Notification.findOneAndDelete({
								$and: [
									{ notificationFromUser: req.body.userId },
									{ notificationOwner: postAuthor.author._id },
									{ notificationType: "like" },
								],
							});
						}
						await Notification.create({
							notificationFromUser: req.body.userId,
							notificationOwner: postAuthor.author._id,
							notificationText: "liked your post",
							notificationType: "like",
							notificationSubject:
								"/profile/" +
								postAuthor.author.username +
								"/status/" +
								req.params.id,
							date: new Date(),
							read: false,
						});
					}

					await Post.findOneAndUpdate(
						{ _id: req.params.id },
						{
							$push: { likedByIdArray: [req.body.userId] },
							$inc: { likesCounter: 1 },
						}
					).then((result) => {
						res
							.status(200)
							.json({ message: "Post updated!", post: result, liked: true });
					});
				}
			} else {
				res.status(401).json({
					message: "User unauthenticated",
				});
			}
		}
	);
});
router.get(
	"/api/search/posts/:keyword",
	checkIfAuthenticated,
	async (req, res, next) => {
		let keyword = req.params.keyword.toString();
		keyword = keyword.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, "\\$&");
		try {
			await Post.find({
				text: { $regex: keyword, $options: "i" },
			})
				.sort({ likesCounter: -1 })
				.then((posts) => {
					res.status(200).json({ message: "Posts found", posts: posts });
				});
		} catch (error) {
			res.status(400).json({
				message: "Posts not found",
			});
		}
	}
);

module.exports = router;
