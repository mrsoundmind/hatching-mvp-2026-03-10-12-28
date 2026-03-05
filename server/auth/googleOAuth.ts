import type { Request } from "express";
import * as oidc from "openid-client";

const GOOGLE_ISSUER = new URL("https://accounts.google.com");
const GOOGLE_ALLOWED_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

let configurationPromise: Promise<oidc.Configuration> | null = null;

export interface VerifiedGoogleIdentity {
  provider: "google";
  providerSub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  return clientId;
}

function getGoogleClientSecret(): string {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  }
  return clientSecret;
}

function getRequestBaseUrl(req: Request): string {
  const configuredBaseUrl = process.env.APP_BASE_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "http";
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwardedHost || req.get("host");
  if (!host) {
    throw new Error("Unable to determine request host for OAuth callback URL");
  }
  return `${proto}://${host}`;
}

export function getGoogleRedirectUri(req: Request): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  return `${getRequestBaseUrl(req)}/api/auth/google/callback`;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function getGoogleConfiguration(): Promise<oidc.Configuration> {
  if (!configurationPromise) {
    configurationPromise = oidc.discovery(
      GOOGLE_ISSUER,
      getGoogleClientId(),
      undefined,
      oidc.ClientSecretPost(getGoogleClientSecret()),
    ).then((config) => {
      if (process.env.NODE_ENV !== "production") {
        oidc.allowInsecureRequests(config);
      }
      return config;
    });
  }

  return configurationPromise;
}

export function generateOAuthState(): string {
  return oidc.randomState();
}

export function generateOAuthNonce(): string {
  return oidc.randomNonce();
}

export function generateCodeVerifier(): string {
  return oidc.randomPKCECodeVerifier();
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  return oidc.calculatePKCECodeChallenge(codeVerifier);
}

export async function buildGoogleAuthorizationUrl(input: {
  req: Request;
  state: string;
  nonce: string;
  codeChallenge: string;
  returnTo?: string;
}): Promise<URL> {
  const config = await getGoogleConfiguration();
  const redirectUri = getGoogleRedirectUri(input.req);
  const params: Record<string, string> = {
    scope: "openid email profile",
    response_type: "code",
    redirect_uri: redirectUri,
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
  };
  if (input.returnTo) {
    params.return_to = input.returnTo;
  }

  return oidc.buildAuthorizationUrl(config, params);
}

function validateGoogleClaims(claims: oidc.IDToken | undefined): VerifiedGoogleIdentity {
  if (!claims) {
    throw new Error("Missing Google ID token claims");
  }

  const issuer = typeof claims.iss === "string" ? claims.iss : "";
  if (!GOOGLE_ALLOWED_ISSUERS.has(issuer)) {
    throw new Error("Invalid Google issuer");
  }

  const clientId = getGoogleClientId();
  const audience = claims.aud;
  const audienceMatches = Array.isArray(audience)
    ? audience.includes(clientId)
    : audience === clientId;
  if (!audienceMatches) {
    throw new Error("Invalid Google audience");
  }

  if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Google token is expired");
  }

  if (typeof claims.sub !== "string" || !claims.sub) {
    throw new Error("Google token subject is missing");
  }

  if (typeof claims.email !== "string" || !claims.email) {
    throw new Error("Google token email is missing");
  }

  if (claims.email_verified === false) {
    throw new Error("Google email is not verified");
  }

  return {
    provider: "google",
    providerSub: claims.sub,
    email: claims.email.toLowerCase(),
    name: typeof claims.name === "string" && claims.name.trim().length > 0
      ? claims.name.trim()
      : claims.email,
    avatarUrl: typeof claims.picture === "string" ? claims.picture : null,
  };
}

export async function exchangeGoogleAuthorizationCode(input: {
  req: Request;
  expectedState: string;
  expectedNonce: string;
  codeVerifier: string;
}): Promise<VerifiedGoogleIdentity> {
  const config = await getGoogleConfiguration();
  const currentUrl = new URL(input.req.originalUrl || input.req.url, getRequestBaseUrl(input.req));

  const tokenResponse = await oidc.authorizationCodeGrant(
    config,
    currentUrl,
    {
      expectedState: input.expectedState,
      expectedNonce: input.expectedNonce,
      pkceCodeVerifier: input.codeVerifier,
      idTokenExpected: true,
    },
    {
      redirect_uri: getGoogleRedirectUri(input.req),
    },
  );

  const claims = tokenResponse.claims();
  return validateGoogleClaims(claims);
}
