import { Router } from "express";
import {
  createTeam,
  getUserTeams,
  getTeamDetails,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
} from "../controller/team/team.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import {
  createTeamSchema,
  addTeamMemberSchema,
} from "../validations/team.validation";

const router = Router();

// Apply auth to all team routes
router.use(authenticate);

router
  .route("/teams")
  .post(validate(createTeamSchema), createTeam)
  .get(getUserTeams);

router
  .route("/teams/:teamId")
  .get(getTeamDetails)
  .delete(deleteTeam);

router
  .route("/teams/:teamId/members")
  .post(validate(addTeamMemberSchema), addTeamMember);

router
  .route("/teams/:teamId/members/:userId")
  .delete(removeTeamMember);

export default router;
