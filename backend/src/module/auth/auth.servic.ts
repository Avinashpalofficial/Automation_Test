import { supabase } from "../../config/supabase";

interface SignUpData {
  email: string;
  password: string;
  name: string;
}
interface SignInData {
  email: string;
  password: string;
}

interface signupData {
  email: string;
  password: string;
  name: string;
}
export async function signupService({ email, password, name }: SignUpData) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,

    options: {
      data: {
        name,
      },
    },
  });
  if (error) {
    console.error("SUPABASE SIGNUP ERROR:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function signinService({ email, password }: SignInData) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error("SUPABASE SIGNIN ERROR:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function oauthSignInService(provider: string) {
  const allowedProviders = ["google", "github"];

  if (!allowedProviders.includes(provider)) {
    throw new Error("Invalid OAuth provider");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as "google" | "github",

    options: {
      redirectTo: "http://localhost:3000/auth/callback",
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function signOutService() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("SUPABASE SIGNOUT ERROR:", error);
    throw new Error(error.message);
  }

  return {
    message: "User signed out successfully",
  };
}
