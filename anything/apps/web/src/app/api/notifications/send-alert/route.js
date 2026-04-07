import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";

const isExpoPushToken = (value) =>
  typeof value === "string" &&
  (value.startsWith("ExpoPushToken[") || value.startsWith("ExponentPushToken["));

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { title, body, data } = await request.json();

    if (!title || !body) {
      return Response.json(
        { success: false, error: "title and body are required" },
        { status: 400 },
      );
    }

    const tokenRows = await sql`
      SELECT expo_push_token
      FROM push_tokens
      WHERE user_id = ${auth.user.id}
    `;

    const tokens = [...new Set(tokenRows.map((row) => row.expo_push_token).filter(isExpoPushToken))];

    if (tokens.length === 0) {
      return Response.json({
        success: false,
        sent: 0,
        error: "No registered push tokens found for this user",
      });
    }

    const pushUrl = new URL("/api/notifications/send-push", request.url).toString();
    const pushResponse = await fetch(pushUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokens,
        title,
        body,
        data: data || {},
        channelId: "alerts",
      }),
    });

    const pushResult = await pushResponse.json().catch(() => ({}));

    if (!pushResponse.ok || pushResult?.success === false) {
      return Response.json(
        {
          success: false,
          sent: 0,
          error: pushResult?.error || "Failed to dispatch push notification",
          details: pushResult?.details || null,
        },
        { status: pushResponse.status || 500 },
      );
    }

    return Response.json({
      success: true,
      sent: pushResult.sent || 0,
      errors: pushResult.errors || 0,
      tokenCount: tokens.length,
      details: pushResult.details || [],
    });
  } catch (error) {
    console.error("Error sending alert notification:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
