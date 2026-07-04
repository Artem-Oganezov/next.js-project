import { connectDB } from "@/lib/db/mongoose";
import { AuthToken } from "@/lib/models/AuthToken";
import { GameSession } from "@/lib/models/GameSession";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";

/** GDPR-style account deletion: user data + sessions + tokens. */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  await connectDB();

  const deleted = await User.findByIdAndDelete(userId);
  if (!deleted) {
    return false;
  }

  await Promise.all([
    Session.deleteMany({ userId }),
    AuthToken.deleteMany({ userId }),
    GameSession.deleteMany({ userId }),
  ]);

  return true;
}
