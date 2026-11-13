/** Shown in an invite dialog when the invite was saved but its email did not go out. */
export function InviteEmailNotice() {
  return (
    <p role="status" className="rounded-lg bg-sun-100 px-3 py-2 text-sm text-bark-700">
      The invite is saved, but the invite email could not be sent. Send it again, or tell them to sign in with
      Google using this email.
    </p>
  );
}
