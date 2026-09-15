export function isLocalDevelopmentAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.LOCAL_AUTH_BYPASS !== "false";
}
