import type { CookieOptions } from "express";

const isProduction =
  process.env.NODE_ENV?.trim().toLowerCase() === "production" ||
  process.env.NODE_ENV?.trim().toLowerCase() === "prod" ||
  (!!process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost"));
const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || undefined;

const cookieSameSite: CookieOptions["sameSite"] =
  (process.env.COOKIE_SAMESITE as CookieOptions["sameSite"]) || "lax";

const cookieSecure =
  process.env.COOKIE_SECURE === "true" ||
  (process.env.COOKIE_SECURE === "false" ? false : isProduction);

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/",
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

const accessTokenCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: 15 * 60 * 1000,
};

const refreshTokenCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const clearCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  expires: new Date(0),
};

export {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  clearCookieOptions,
};
