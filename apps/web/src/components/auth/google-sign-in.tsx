import { getAuthProviders } from "@/lib/server-api/auth-providers";
import { GoogleSignInButton } from "./google-sign-in-button";

/** "Continue with Google" and an "or" divider, shown only when the API has Google set up. */
export async function GoogleSignIn(props: { callbackURL?: string; newUserCallbackURL?: string }) {
  const { google } = await getAuthProviders();
  if (!google) return null;

  return (
    <div className="mt-6">
      <GoogleSignInButton {...props} />
      <div className="mt-6 flex items-center gap-3 text-xs text-sub" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
