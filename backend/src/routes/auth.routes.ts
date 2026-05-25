import { Router } from "express";
import {
  authCallbackController,
  oauthSignInController,
  signinController,
  signOutController,
  signupController,
} from "../module/auth/auth.controller";
import { signinSchema, signupSchema } from "../validation/validation";
import { validate } from "../middleware/validate.middlewate";
import { signinLimiter } from "../permission/rate_limiter";
const router = Router();
router.post("/signup", validate(signupSchema), signupController);
router.post("/signin", validate(signinSchema), signinLimiter, signinController);
router.post("/sign-in/oauth/:provider", oauthSignInController);
router.post("/sign-out", signOutController);
router.get("/callback", authCallbackController);

export default router;
