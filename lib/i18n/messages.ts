/** Central API / validation messages (English). Customize for your product locale. */
export const msg = {
  common: {
    invalidPayload: "Invalid request data",
    invalidJson: "Invalid JSON body",
    tooManyRequests: "Too many requests",
    unauthorized: "Unauthorized",
    forbidden: "Forbidden",
    internalError: "Internal server error",
  },
  auth: {
    invalidCredentials: "Invalid credentials",
    accountBanned: "Account is banned",
    userExists: "Username or email already taken",
    usernameMin: "Username: minimum 3 characters",
    usernameMax: "Username: maximum 30 characters",
    usernameFormat: "Username: letters, digits and underscore only",
    passwordMin: "Password: minimum 8 characters",
    passwordMax: "Password: too long",
    invalidEmail: "Invalid email",
    resetTokenInvalid: "Invalid or expired reset token",
    currentPasswordWrong: "Current password is incorrect",
    passwordWrong: "Password is incorrect",
    newPasswordSame: "New password must differ from current password",
    emailAlreadyVerified: "Email is already verified",
    resetEmailSent:
      "If an account exists for this email, a reset link has been sent.",
    verifyTokenRequired: "Token is required",
    verifyLinkInvalid: "Invalid or expired verification link",
  },
  game: {
    startFirst: "Start a game session first",
    alreadySubmitted: "This run was already submitted",
    inputLogTooLarge: "Input log too large",
    tooManyRequests: "Too many requests",
    reviveUnavailable: "Revive is not available for this run",
    reviveMismatch: "Revive data does not match session",
    saveFailed: "Could not save score — check your connection",
    scoreJobNotFound: "Score save job not found",
  },
  skins: {
    skinIdRequired: "skinId is required",
    notFound: "Skin not found",
    alreadyUnlocked: "Already unlocked",
    insufficientPoints: "Insufficient points",
    notUnlocked: "Skin is not unlocked",
  },
  admin: {
    notConfigured: "Admin is not configured",
    invalidSecret: "Invalid admin secret",
    userNotFound: "User not found",
  },
  metrics: {
    notConfigured: "Metrics are not configured",
  },
} as const;

export function rateLimitMessage(retryAfterSec: number): string {
  return `Too many requests. Retry in ${retryAfterSec} seconds.`;
}
