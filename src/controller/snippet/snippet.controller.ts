import { Request, Response } from "express";
import crypto from "crypto";
import Snippet from "../../schema/snippet.schema";
import User from "../../schema/user.schema";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { ApiResponse } from "../../utils/apiResponse";

// Helper to generate a unique short alphanumeric ID
const generateShortId = async (): Promise<string> => {
  let unique = false;
  let shortId = "";
  while (!unique) {
    shortId = crypto.randomBytes(4).toString("hex"); // 8 chars e.g. "f3a8b1c2"
    const existing = await Snippet.findOne({ shortId });
    if (!existing) {
      unique = true;
    }
  }
  return shortId;
};

// 1. Create a new Snippet (works for both logged in users and guests)
export const createSnippet = asyncHandler(async (req: Request, res: Response) => {
  const { title, code, language, description, isPublic } = req.body;

  if (!code || typeof code !== "string" || !code.trim()) {
    throw new ApiError(400, "Code content is required to create a snippet.");
  }

  let authorId = undefined;
  let authorName = "Anonymous";

  if (req.user?.id) {
    authorId = req.user.id;
    const user = await User.findById(req.user.id).select("name email");
    if (user) {
      authorName = user.name || user.email.split("@")[0];
    }
  }

  const shortId = await generateShortId();

  const snippet = await Snippet.create({
    shortId,
    title: (title || "").trim() || "Untitled Snippet",
    code: code.trim(),
    language: (language || "javascript").trim().toLowerCase(),
    description: (description || "").trim(),
    authorId,
    authorName,
    isPublic: isPublic !== false,
  });

  return res.status(201).json(
    new ApiResponse(
      "Snippet created successfully",
      {
        snippet,
        shareUrl: `https://codesroom.in/s/${snippet.shortId}`,
        embedUrl: `https://codesroom.in/embed/s/${snippet.shortId}`,
      }
    )
  );
});

// 2. Get Snippet by shortId (increments view count)
export const getSnippetByShortId = asyncHandler(async (req: Request, res: Response) => {
  const { shortId } = req.params;

  if (!shortId) {
    throw new ApiError(400, "Snippet ID is required.");
  }

  // Atomically increment views and return the document
  const snippet = await Snippet.findOneAndUpdate(
    { shortId },
    { $inc: { views: 1 } },
    { new: true }
  ).populate("authorId", "name email avatar");

  if (!snippet) {
    throw new ApiError(404, "Snippet not found.");
  }

  return res.status(200).json(
    new ApiResponse(
      "Snippet retrieved successfully",
      {
        snippet,
        shareUrl: `https://codesroom.in/s/${snippet.shortId}`,
        embedUrl: `https://codesroom.in/embed/s/${snippet.shortId}`,
      }
    )
  );
});

// 3. Fork an existing Snippet
export const forkSnippet = asyncHandler(async (req: Request, res: Response) => {
  const { shortId } = req.params;
  const original = await Snippet.findOne({ shortId });

  if (!original) {
    throw new ApiError(404, "Original snippet not found.");
  }

  let authorId = undefined;
  let authorName = "Anonymous";

  if (req.user?.id) {
    authorId = req.user.id;
    const user = await User.findById(req.user.id).select("name email");
    if (user) {
      authorName = user.name || user.email.split("@")[0];
    }
  }

  const newShortId = await generateShortId();

  const forked = await Snippet.create({
    shortId: newShortId,
    title: `${original.title} (Fork)`,
    code: original.code,
    language: original.language,
    description: original.description,
    authorId,
    authorName,
    isPublic: true,
    forkedFrom: original.shortId,
  });

  return res.status(201).json(
    new ApiResponse(
      "Snippet forked successfully",
      {
        snippet: forked,
        shareUrl: `https://codesroom.in/s/${forked.shortId}`,
        embedUrl: `https://codesroom.in/embed/s/${forked.shortId}`,
      }
    )
  );
});

// 4. Get snippets created by current user
export const getMySnippets = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new ApiError(401, "Authentication required to view your snippets.");
  }

  const snippets = await Snippet.find({ authorId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50);

  return res.status(200).json(
    new ApiResponse("User snippets retrieved successfully", snippets)
  );
});
