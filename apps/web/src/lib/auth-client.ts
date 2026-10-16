import { createAuthClient } from "better-auth/react";

/** Same-origin client; /api is rewritten to the NestJS API. */
export const authClient = createAuthClient({ basePath: "/api/v1/auth" });
