import sql from '@/app/api/utils/sql';
import { requireAuthenticatedUser } from '@/app/api/utils/supabase-auth';

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      return auth.response;
    }

    const { reportId } = await request.json();
    const userId = auth.user.id;

    if (!reportId) {
      return Response.json(
        { success: false, error: 'reportId is required' },
        { status: 400 },
      );
    }

    const deletedReports = await sql`
      DELETE FROM live_reports
      WHERE id = ${reportId}
        AND user_id = ${userId}
      RETURNING id;
    `;

    if (deletedReports.length === 0) {
      return Response.json(
        { success: false, error: 'Report not found or not owned by this user' },
        { status: 404 },
      );
    }

    return Response.json({
      success: true,
      reportId: deletedReports[0].id,
    });
  } catch (error) {
    console.error('Error deleting spot:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
