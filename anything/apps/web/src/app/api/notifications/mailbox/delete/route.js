import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import {
  ensureHiddenNotificationsSchema,
  ensureHiddenNotificationsUserRow,
  hideNotifications,
  normalizeHiddenNotificationIds,
  HIDDEN_NOTIFICATION_FEED_TYPES,
} from "@/app/api/utils/hidden-notifications";

export async function POST(request) {
  try {
    await ensureHiddenNotificationsSchema();

    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    await ensureHiddenNotificationsUserRow(auth.user);

    const body = await request.json().catch(() => ({}));
    const notificationIds = normalizeHiddenNotificationIds(body?.ids);

    if (notificationIds.length === 0) {
      return Response.json(
        { success: false, error: "ids is required" },
        { status: 400 },
      );
    }

    const insertedIds = await hideNotifications({
      userId: auth.user.id,
      feedType: HIDDEN_NOTIFICATION_FEED_TYPES.mailbox,
      notificationIds,
    });

    return Response.json({
      success: true,
      hiddenIds: notificationIds,
      insertedIds,
    });
  } catch (error) {
    console.error("Error hiding mailbox notifications:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to hide mailbox notifications" },
      { status: 500 },
    );
  }
}
