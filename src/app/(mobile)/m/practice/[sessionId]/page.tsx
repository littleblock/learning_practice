import { UserRole } from "@prisma/client";

import { PracticePlayer } from "@/features/mobile/components/practice-player";
import { requirePageRole } from "@/server/auth/guards";
import { getPracticeSessionView } from "@/server/services/practice-service";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const session = await requirePageRole(UserRole.LEARNER, "/m/login");
  const { sessionId } = await params;
  const view = await getPracticeSessionView(session.user.id, sessionId);

  return <PracticePlayer initialView={view} />;
}
