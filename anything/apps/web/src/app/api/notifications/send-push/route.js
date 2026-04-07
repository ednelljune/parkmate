/**
 * Send actual Expo push notifications
 * This endpoint sends notifications via Expo's push notification service
 */
export async function POST(request) {
  try {
    const { tokens, title, body, data, channelId = "alerts" } = await request.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return Response.json(
        { success: false, error: "tokens array is required" },
        { status: 400 },
      );
    }

    const uniqueTokens = [...new Set(tokens.filter(Boolean))];

    const messages = uniqueTokens.map((token) => ({
      to: token,
      sound: "default",
      title: title || "Notification",
      body: body || "",
      data: data || {},
      priority: "high",
      channelId,
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Expo push service error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const errors = result.data?.filter((item) => item.status === "error") || [];

    return Response.json({
      success: true,
      sent: result.data?.length || 0,
      errors: errors.length,
      details: result.data,
    });
  } catch (error) {
    console.error("Error sending push notifications:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
