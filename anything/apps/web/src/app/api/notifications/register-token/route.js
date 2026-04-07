import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { expoPushToken } = await request.json();
    const userId = auth.user.id;

    if (!expoPushToken) {
      return Response.json(
        { success: false, error: "expoPushToken is required" },
        { status: 400 },
      );
    }

    await sql`
      INSERT INTO push_tokens (user_id, expo_push_token)
      VALUES (${userId}, ${expoPushToken})
      ON CONFLICT (expo_push_token) DO UPDATE
      SET
        user_id = EXCLUDED.user_id,
        updated_at = CURRENT_TIMESTAMP
    `;

    return Response.json({
      success: true,
      userId,
      expoPushToken,
    });
  } catch (error) {
    console.error("Error registering push token:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
