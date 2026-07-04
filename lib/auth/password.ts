import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

/** Precomputed hash — used when user is missing to equalize login timing. */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$5me5Vg0EOJabJBOYLmaNqO4qoD9nAyYU8.DvoYPyrkiLo8dlPOKtq";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/** Always runs bcrypt — pass DUMMY_PASSWORD_HASH when user does not exist. */
export async function verifyLoginPassword(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  return verifyPassword(password, passwordHash ?? DUMMY_PASSWORD_HASH);
}
