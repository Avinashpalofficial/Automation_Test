import { Router } from "express";
import {
  oauthSignInController,
  signinController,
  signOutController,
  signupController,
} from "../module/auth/auth.controller";
import { signupSchema } from "../validation/validation";
// import { validate } from "../middleware/validate.middlewate";
const router = Router();
router.post("/signup", signupController);
router.post("/signin", signinController);
router.post("/sign-in/oauth/:provider", oauthSignInController);
router.post("/sign-out", signOutController);
export default router;
