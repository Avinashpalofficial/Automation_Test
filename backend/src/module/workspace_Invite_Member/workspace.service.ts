import { createAuthorizedClient } from "../../lib/supabase";
import crypto from "crypto";
// import { supabase } from "../../config/supabase";
import { sendEmail } from "../../utils/sendEmail";
import { generateInviteId } from "../../utils/generate-id";
import { supabase } from "../../config/supabase";

interface InviteMemberServiceInput {
  workspaceId: string;
  email: string;
  role: string;
  invitedBy: string;
  token: string;
}
interface AcceptInviteInput {
  token: string;
  userId: string;
  email: string;
}
export async function inviteMemberService({
  workspaceId,
  email,
  role,
  invitedBy,
  token,
}: InviteMemberServiceInput) {
  const supabase = createAuthorizedClient(token);

  // validate role
  const allowedRoles = ["admin", "editor"];

  if (!allowedRoles.includes(role)) {
    throw new Error("Invalid role");
  }
  console.log("workspaceId:", workspaceId);
  console.log("invitedBy:", invitedBy);
  // check inviter membership
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", invitedBy)
    .maybeSingle();
  console.log("membership:", membership);
  console.log("membership error:", membershipError);

  if (!membership) {
    throw new Error("Access denied");
  }

  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Only admins can invite members");
  }

  // check existing pending invite
  const { data: existingInvite } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("email", email)
    .is("accepted_at", null)
    .maybeSingle();

  if (existingInvite) {
    throw new Error("User already has pending invite");
  }

  // generate token
  const inviteToken = crypto.randomBytes(24).toString("hex");

  // create invite
  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      id: generateInviteId(),
      workspace_id: workspaceId,
      email,
      role,
      token: inviteToken,
      invited_by: invitedBy,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("INVITE ERROR:", error);

    throw new Error(error.message);
  }

  const inviteLink = `http://localhost:3000/invite/${inviteToken}`;
  await sendEmail({
    email,
    subject: "Workspace Invitation",
    message: `
    <h2>You have been invited to join a workspace</h2>

    <p>You were invited as <b>${role}</b>.</p>

    <p>
      Click the button below to accept the invitation:
    </p>

    <a 
      href="${inviteLink}"
      style="
        display:inline-block;
        padding:10px 18px;
        background:#000;
        color:#fff;
        text-decoration:none;
        border-radius:6px;
      "
    >
      Accept Invite
    </a>

    <p>This invite will expire in 7 days.</p>
  `,
    text: `Join workspace using this link: ${inviteLink}`,
  });

  return {
    invite: data,
    inviteLink: `http://localhost:3000/invite/${inviteToken}`,
  };
}

export async function acceptInviteService({
  token,
  userId,
  email,
}: AcceptInviteInput) {
  // 1. find invite
  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    throw new Error("Invite not found");
  }

  // 2. already accepted?
  if (invite.status === "ACCEPTED") {
    throw new Error("Invite already accepted");
  }

  // 3. expired?
  const now = new Date();

  if (new Date(invite.expires_at) < now) {
    throw new Error("Invite expired");
  }

  // 4. email validation
  console.log(email);
  console.log(invite.email);

  if (invite.email !== email) {
    throw new Error("This invite does not belong to your account");
  }

  // 5. already member?
  const { data: existingMember } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember) {
    throw new Error("Already a workspace member");
  }

  // 6. add member
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: invite.workspace_id,
      user_id: userId,
      role: invite.role,
      invited_by: invite.invited_by,
    });

  if (memberError) {
    throw new Error(memberError.message);
  }

  // 7. update invite status
  await supabase
    .from("workspace_invites")
    .update({
      status: "ACCEPTED",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  return {
    workspaceId: invite.workspace_id,
    role: invite.role,
  };
}
