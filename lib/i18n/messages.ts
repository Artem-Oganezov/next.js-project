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
    registrationUnavailable:
      "Registration is temporarily unavailable. Try again later.",
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
    googleEmailTaken:
      "This email is already registered with a password. Log in with your password instead.",
    googleNotConfigured: "Google sign-in is not available",
    googleSignInFailed: "Google sign-in failed. Please try again.",
    googlePasswordUnavailable: "Password sign-in is not available for this account",
  },
  game: {
    startFirst: "Start a game session first",
    alreadySubmitted: "This run was already submitted",
    inputLogTooLarge: "Input log too large",
    tooManyRequests: "Too many requests",
    reviveUnavailable: "Revive is not available for this run",
    reviveChallengeRequired: "Start revive challenge before claiming revive",
    reviveChallengeTooEarly: "Revive is not ready yet",
    reviveMismatch: "Revive data does not match session",
    saveFailed: "Could not save score — check your connection",
    scoreJobNotFound: "Score save job not found",
    scoreJobTimedOut: "Score save timed out — try again",
    emailNotVerified: "Verify your email before playing",
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
