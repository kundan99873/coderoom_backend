import { Router } from "express";
import {
  createSnippet,
  getSnippetByShortId,
  forkSnippet,
  getMySnippets,
} from "../controller/snippet/snippet.controller";
import { authenticate, optionalAuthenticate } from "../middleware/auth.middleware";

const snippetRouter = Router();

// Public / optionally authenticated
snippetRouter.post("/snippets", optionalAuthenticate, createSnippet);
snippetRouter.get("/snippets/:shortId", getSnippetByShortId);
snippetRouter.post("/snippets/:shortId/fork", optionalAuthenticate, forkSnippet);

// Authenticated user snippets
snippetRouter.get("/snippets/my/all", authenticate, getMySnippets);

export default snippetRouter;
