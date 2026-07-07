import { connectDB } from "@/lib/db/mongoose";
import { AuthToken } from "@/lib/models/AuthToken";
import { GameSession } from "@/lib/models/GameSession";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";
import { purgeUserPlatformState } from "@/lib/user/platform-removal";

/** GDPR-style account deletion: user data + sessions + tokens + public caches. */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  await connectDB();

  const user = await User.findById(userId).select("username");
  if (!user) {
    return false;
  }

  await purgeUserPlatformState(userId, user.username);

  await User.findByIdAndDelete(userId);
  await Promise.all([
    Session.deleteMany({ userId }),
    AuthToken.deleteMany({ userId }),
    GameSession.deleteMany({ userId }),
  ]);

  return true;
}
