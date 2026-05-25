import { signupService } from "./auth.servic";
import { signinService } from "./auth.servic";
import { Request, Response } from "express";
import { oauthSignInService } from "./auth.servic";
import { signOutService } from "./auth.servic";
import { supabase } from "../../config/supabase";

/**user sign up */
export async function signupController(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    const data = await signupService({ email, password, name });
    const response = {
      user: {
        id: data.user?.id,
        email: data.user?.email,
        name: data.user?.user_metadata.name,
        role: data.user?.role,
      },
      accessToken: data.session?.access_token,
    };
    res.status(201).json({ mesg: "Signup successful", data });
  } catch (error: any) {
    res.status(400).json({ mesg: error.mesg });
  }
}

/*  user login  */
export async function signinController(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const data = await signinService({ email, password });
    const safeResponse = {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata.name,
        role: data.user.role,
      },
      accessToken: data.session.access_token,
    };
    res.status(200).json({ mesg: "sign in successful", data: safeResponse });
  } catch (error: any) {
    console.error("SIGNIN CONTROLLER ERROR:", error);
    res.status(400).json({ mesg: error.mesg });
  }
}
/**oauthSignInController */
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
/**auth callback controller */
export const authCallbackController = async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;

    if (!code) {
      return res.status(400).json({
        error: "No code provided",
      });
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(200).json({
      message: "OAuth login successful",
      session: data.session,
      user: data.user,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

/**sign out controller */
export async function signOutController(req: Request, res: Response) {
  try {
    const data = await signOutService();
    res.status(200).json(data);
  } catch (error) {
    console.error("SIGNOUT CONTROLLER ERROR:", error);
    res.status(400).json({ mesg: "Error occurred while signing out" });
  }
}
