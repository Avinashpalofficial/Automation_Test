import { signupService } from "./auth.servic";
import { signinService } from "./auth.servic";
import { Request, Response } from "express";
import { oauthSignInService } from "./auth.servic";
import { signOutService } from "./auth.servic";
export async function signupController(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    const data = await signupService({ email, password, name });
    res.status(201).json({ mesg: "User signed up successfully", data });
  } catch (error) {
    res.status(400).json({ mesg: "Error occurred while signing up" });
  }
}

/*  user login  */
export async function signinController(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const data = await signinService({ email, password });
    res.status(200).json({ mesg: "sing in successful", data });
  } catch (error) {
    console.error("SIGNIN CONTROLLER ERROR:", error);
    res.status(400).json({ mesg: "Error occurred while signing in" });
  }
}

export async function oauthSignInController(req: Request, res: Response) {
  try {
    const provider = req.params.provider;
    if (typeof provider !== "string") {
      return res.status(400).json({
        error: {
          code: "invalid_provider",
          message: "Invalid OAuth provider",
        },
      });
    }

    const data = await oauthSignInService(provider);

    return res.status(200).json({
      url: data.url,
    });
  } catch (error: any) {
    return res.status(400).json({
      error: {
        code: "oauth_signin_failed",
        message: error.message,
      },
    });
  }
}

export async function signOutController(req: Request, res: Response) {
  try {
    const data = await signOutService();
    res.status(200).json(data);
  } catch (error) {
    console.error("SIGNOUT CONTROLLER ERROR:", error);
    res.status(400).json({ mesg: "Error occurred while signing out" });
  }
}
