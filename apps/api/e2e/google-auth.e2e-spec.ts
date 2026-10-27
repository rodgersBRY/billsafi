import type { INestApplication } from "@nestjs/common";
import { type DatabaseConnection, and, eq, schema } from "@billsafi/db";
import request from "supertest";
import { AccountAccessService } from "../src/admin/tenants/account-access.service.js";
import { DATABASE } from "../src/database/database.module.js";
import { createTestApp, signUp, uniqueEmail, WEB_ORIGIN } from "./support/app.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** An ID token as Google's token endpoint returns it; Better Auth only decodes it here. */
function idToken(claims: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256", typ: "JWT" })}.${part({
    iss: "https://accounts.google.com",
    aud: process.env.GOOGLE_CLIENT_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  })}.signature`;
}

describe("Google sign-in", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const db = () => app.get<DatabaseConnection>(DATABASE).db;
  const realFetch = globalThis.fetch;
  let googleProfile: Record<string, unknown> = {};

  beforeAll(async () => {
    ({ app } = await createTestApp());
    // Stand in for Google's token endpoint; every other request goes out as normal.
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.startsWith(GOOGLE_TOKEN_URL)) return realFetch(input, init);
      return Response.json({
        access_token: "google-access-token",
        expires_in: 3599,
        scope: "openid email profile",
        token_type: "Bearer",
        id_token: idToken(googleProfile),
      });
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  /** Starts sign-in the way the web button does and returns Google's URL and the state cookie. */
  async function startGoogleSignIn() {
    const response = await api()
      .post("/api/v1/auth/sign-in/social")
      .set("Origin", WEB_ORIGIN)
      .send({
        provider: "google",
        callbackURL: "/",
        newUserCallbackURL: "/onboarding",
        errorCallbackURL: "/sign-in",
      })
      .expect(200);
    const setCookie = ([] as string[]).concat(response.headers["set-cookie"] ?? []);
    return {
      url: new URL(response.body.url),
      cookies: setCookie.map((cookie) => cookie.split(";")[0]).join("; "),
    };
  }

  /** Completes the round trip as if Google redirected back with a code. */
  async function finishGoogleSignIn(profile: Record<string, unknown>) {
    googleProfile = profile;
    const { url, cookies } = await startGoogleSignIn();
    const response = await api()
      .get("/api/v1/auth/callback/google")
      .query({ code: "google-auth-code", state: url.searchParams.get("state") })
      .set("Cookie", cookies)
      .expect(302);
    const setCookie = ([] as string[]).concat(response.headers["set-cookie"] ?? []);
    return {
      location: new URL(response.headers.location!, WEB_ORIGIN),
      session: setCookie.find((cookie) => cookie.startsWith("better-auth.session_token=")),
    };
  }

  function googleUser(email: string, sub = crypto.randomUUID()) {
    return { sub, email, email_verified: true, name: "Njeri Mwangi", picture: null };
  }

  it("tells the web app that Google sign-in is available", async () => {
    const response = await api().get("/api/v1/auth-providers").expect(200);
    expect(response.body).toEqual({ google: true });
  });

  it("sends people to Google with PKCE, state, and only basic scopes", async () => {
    const { url, cookies } = await startGoogleSignIn();

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe(`${WEB_ORIGIN}/api/v1/auth/callback/google`);
    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual([
      "email",
      "openid",
      "profile",
    ]);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(cookies).toContain("better-auth.state=");
  });

  it("refuses a callback without the browser's state cookie", async () => {
    googleProfile = googleUser(uniqueEmail("no-state"));
    const { url } = await startGoogleSignIn();

    const response = await api()
      .get("/api/v1/auth/callback/google")
      .query({ code: "google-auth-code", state: url.searchParams.get("state") })
      .expect(302);

    expect(response.headers.location).toMatch(/\/sign-in\?error=/);
    expect(response.headers["set-cookie"]?.toString() ?? "").not.toContain(
      "better-auth.session_token=",
    );
  });

  it("creates a verified account for a new Google user and sends them to setup", async () => {
    const email = uniqueEmail("google-new");
    const { location, session } = await finishGoogleSignIn(googleUser(email));

    expect(location.pathname).toBe("/onboarding");
    expect(session).toBeDefined();

    const me = await api()
      .get("/api/v1/auth/get-session")
      .set("Cookie", session!.split(";")[0]!)
      .expect(200);
    expect(me.body.user).toMatchObject({ email, name: "Njeri Mwangi", emailVerified: true });
  });

  it("does not keep Google tokens after sign-in", async () => {
    const email = uniqueEmail("google-tokens");
    await finishGoogleSignIn(googleUser(email));

    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
    const [account] = await db()
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, user!.id), eq(schema.accounts.providerId, "google")));
    expect(account).toMatchObject({ accessToken: null, refreshToken: null, idToken: null });
    // The Google subject id is what ties future sign-ins to this account.
    expect(account!.accountId).toBeTruthy();
  });

  it("signs a returning Google user straight in", async () => {
    const email = uniqueEmail("google-returning");
    const profile = googleUser(email);
    await finishGoogleSignIn(profile);

    const { location, session } = await finishGoogleSignIn(profile);
    expect(location.pathname).toBe("/");
    expect(session).toBeDefined();
  });

  it("refuses a suspended Google user and ends their session", async () => {
    const email = uniqueEmail("google-suspended");
    const profile = googleUser(email);
    const first = await finishGoogleSignIn(profile);
    const cookie = first.session!.split(";")[0]!;
    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));

    await app.get(AccountAccessService).suspend(user!.id, "Suspended in an e2e test");

    const me = await api().get("/api/v1/auth/get-session").set("Cookie", cookie).expect(200);
    expect(me.body).toBeNull();
    const { location, session } = await finishGoogleSignIn(profile);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("error")).toBe("BANNED_USER");
    expect(session).toBeUndefined();
  });

  it("never merges Google into an existing password account with the same email", async () => {
    // Password sign-ups are not email-verified, so whoever registered first may not own the inbox.
    const { email } = await signUp(app, uniqueEmail("pre-registered"));

    const { location, session } = await finishGoogleSignIn(googleUser(email));

    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("error")).toBe("account_not_linked");
    expect(session).toBeUndefined();
    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
    const linked = await db()
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, user!.id), eq(schema.accounts.providerId, "google")));
    expect(linked).toHaveLength(0);
  });
});
