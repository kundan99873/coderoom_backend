import { z } from "zod";

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100),
  description: z.string().max(500).optional(),
});

const addTeamMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export {
  createTeamSchema,
  addTeamMemberSchema,
};
