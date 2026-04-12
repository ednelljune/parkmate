import sql from "@/app/api/utils/sql";
import { requireAuthenticatedUser } from "@/app/api/utils/supabase-auth";
import { logUserActivity } from "@/app/api/utils/activity-log";
import {
  applyEffectiveReportExpiry,
  REPORT_TTL_MS,
} from "@/app/api/utils/report-ttl";

const EXCLUDED_ZONE_TYPE = "meter";
let reportIdempotencySchemaPromise = null;

const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function getDisplayNameFallback(user) {
  const metadataName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    null;

  if (metadataName) {
    return metadataName;
  }

  const email = typeof user.email === "string" ? user.email.trim() : "";
  const [localPart] = email.split("@");
  return localPart || null;
}

const ensureReportIdempotencySchema = () => {
  if (!reportIdempotencySchemaPromise) {
    reportIdempotencySchemaPromise = (async () => {
      await sql`
        ALTER TABLE live_reports
        ADD COLUMN IF NOT EXISTS client_report_id TEXT;
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_live_reports_client_report_id
        ON live_reports (client_report_id);
      `;
    })().catch((error) => {
      reportIdempotencySchemaPromise = null;
      throw error;
    });
  }

  return reportIdempotencySchemaPromise;
};

export async function POST(request) {
  try {
    const authorizationHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");

    console.log("[report.create] Incoming report request", {
      url: request.url,
      method: request.method,
      hasAuthorizationHeader: !!authorizationHeader,
      authorizationScheme: authorizationHeader?.split(" ")[0] || null,
      contentType: request.headers.get("content-type"),
      hasProjectGroupHeader: !!request.headers.get("x-createxyz-project-group-id"),
    });

    const auth = await requireAuthenticatedUser(request);
    if (auth.response) {
      console.warn("[report.create] Request rejected before insert", {
        url: request.url,
      });
      return auth.response;
    }

    await ensureReportIdempotencySchema();

    const {
      latitude,
      longitude,
      userLatitude,
      userLongitude,
      parkingType,
      quantity,
      clientReportId,
      zoneId,
    } = await request.json();
    const userId = auth.user.id;
    const normalizedLatitude = normalizeCoordinate(latitude);
    const normalizedLongitude = normalizeCoordinate(longitude);
    const normalizedUserLatitude =
      normalizeCoordinate(userLatitude) ?? normalizedLatitude;
    const normalizedUserLongitude =
      normalizeCoordinate(userLongitude) ?? normalizedLongitude;
    const normalizedParkingType =
      typeof parkingType === "string" && parkingType.trim()
        ? parkingType.trim()
        : null;
    const normalizedParkingTypeLower =
      typeof normalizedParkingType === "string"
        ? normalizedParkingType.toLowerCase()
        : null;
    const effectiveParkingType =
      normalizedParkingTypeLower?.includes(EXCLUDED_ZONE_TYPE)
        ? null
        : normalizedParkingType;
    const normalizedClientReportId =
      typeof clientReportId === "string" && clientReportId.trim()
        ? clientReportId.trim()
        : null;
    const normalizedQuantity = Math.max(
      1,
      Number.isFinite(Number(quantity)) ? Math.floor(Number(quantity)) : 1,
    );
    const normalizedZoneId =
      zoneId == null || zoneId === ""
        ? null
        : Number.isFinite(Number(zoneId))
          ? Number(zoneId)
          : null;
    const fullName = getDisplayNameFallback(auth.user);
    const email = auth.user.email || "";

    console.log("[report.create] Parsed request body", {
      userId,
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      userLatitude: normalizedUserLatitude,
      userLongitude: normalizedUserLongitude,
      parkingType,
      effectiveParkingType,
      quantity,
      clientReportId: normalizedClientReportId,
      zoneId: normalizedZoneId,
    });

    if (normalizedLatitude === null || normalizedLongitude === null) {
      console.warn("[report.create] Missing coordinates", {
        userId,
        latitude: normalizedLatitude,
        longitude: normalizedLongitude,
      });
      return Response.json(
        { success: false, message: "latitude and longitude are required." },
        { status: 400 },
      );
    }

    if (normalizedUserLatitude === null || normalizedUserLongitude === null) {
      console.warn("[report.create] Missing user coordinates", {
        userId,
        userLatitude: normalizedUserLatitude,
        userLongitude: normalizedUserLongitude,
      });
      return Response.json(
        {
          success: false,
          message:
            "Your current location is required to confirm you are inside a mapped parking zone before reporting a spot.",
        },
        { status: 400 },
      );
    }

    await sql`
      INSERT INTO users (id, email, full_name)
      VALUES (${userId}, ${email}, ${fullName})
      ON CONFLICT (id) DO UPDATE
      SET
        email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
        full_name = COALESCE(users.full_name, EXCLUDED.full_name);
    `;

    const userResults = await sql`
      SELECT trust_score FROM users WHERE id = ${userId} LIMIT 1;
    `;
    const userTrustScore = userResults[0]?.trust_score || 100;

    console.log("[report.create] User trust score loaded", {
      userId,
      userTrustScore,
    });

    if (userTrustScore < 30) {
      console.warn("[report.create] Trust score blocked report", {
        userId,
        userTrustScore,
      });
      return Response.json(
        {
          success: false,
          message:
            "Your trust score is too low to report parking spots. Please contact support.",
        },
        { status: 403 },
      );
    }

    let pointsToAward = 5;
    if (userTrustScore >= 90) {
      pointsToAward = 7;
    } else if (userTrustScore >= 70) {
      pointsToAward = 6;
    } else if (userTrustScore < 50) {
      pointsToAward = 3;
    }

    let zone = null;

    if (normalizedZoneId != null) {
      const selectedZoneResults = await sql`
        SELECT id, name, zone_type
        FROM parking_zones
      WHERE id = ${normalizedZoneId}
        AND LOWER(COALESCE(zone_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
          AND ST_Covers(
            boundary,
            ST_SetSRID(ST_Point(${normalizedUserLongitude}, ${normalizedUserLatitude}), 4326)
          )
        LIMIT 1;
      `;
      zone = selectedZoneResults[0] || null;
    }

    if (!zone) {
      const zoneResults = await sql`
        SELECT id, name, zone_type
        FROM parking_zones
        WHERE LOWER(COALESCE(zone_type, '')) NOT LIKE '%' || ${EXCLUDED_ZONE_TYPE} || '%'
          AND ST_Covers(
            boundary,
            ST_SetSRID(ST_Point(${normalizedUserLongitude}, ${normalizedUserLatitude}), 4326)
          )
        LIMIT 1;
      `;
      zone = zoneResults[0] || null;
    }

    console.log("[report.create] Zone lookup result", {
      userId,
      zoneId: zone?.id || null,
      zoneName: zone?.name || null,
      zoneType: zone?.zone_type || null,
    });

    if (!zone) {
      return Response.json(
        {
          success: false,
          message:
            "You can only report a spot when your current location is inside a mapped parking zone.",
        },
        { status: 403 },
      );
    }

    const expiresAt = new Date(Date.now() + REPORT_TTL_MS);
    const reportResults = await sql`
      INSERT INTO live_reports (
        user_id,
        location,
        zone_id,
        expires_at,
        status,
        parking_type,
        quantity,
        client_report_id
      )
      VALUES (
        ${userId},
        ST_SetSRID(ST_Point(${normalizedLongitude}, ${normalizedLatitude}), 4326),
        ${zone?.id || null},
        ${expiresAt},
        ${"available"},
        ${effectiveParkingType || zone?.zone_type || null},
        ${normalizedQuantity},
        ${normalizedClientReportId}
      )
      ON CONFLICT (client_report_id) DO NOTHING
      RETURNING id, user_id, zone_id, created_at, expires_at, status, parking_type, quantity, client_report_id;
    `;

    let newReport = reportResults[0] || null;
    let wasDuplicateSubmission = false;

    if (!newReport && normalizedClientReportId) {
      wasDuplicateSubmission = true;
      const existingReportResults = await sql`
        SELECT id, user_id, zone_id, created_at, expires_at, status, parking_type, quantity, client_report_id
        FROM live_reports
        WHERE user_id = ${userId}
          AND client_report_id = ${normalizedClientReportId}
        LIMIT 1;
      `;

      newReport = existingReportResults[0] || null;
    }

    if (!newReport) {
      throw new Error("Report insert did not return a row");
    }

    if (wasDuplicateSubmission) {
      console.warn("[report.create] Duplicate report submission reused existing row", {
        userId,
        clientReportId: normalizedClientReportId,
        reportId: newReport.id || null,
      });
    } else {
      await logUserActivity({
        userId,
        reportId: newReport.id,
        activityType: "reported",
        parkingType: effectiveParkingType,
        quantity: normalizedQuantity,
        longitude: normalizedLongitude,
        latitude: normalizedLatitude,
        zoneType: zone?.zone_type || effectiveParkingType,
        zoneName: zone?.name || "Reported spot",
        spotStatus: "available",
        occurredAt: newReport.created_at,
      });

      await sql`
        UPDATE users
        SET contribution_score = contribution_score + ${pointsToAward}
        WHERE id = ${userId};
      `;

      try {
        const notificationsUrl = new URL("/api/notifications/create", request.url).toString();
        await fetch(notificationsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: newReport.id,
            latitude: normalizedLatitude,
            longitude: normalizedLongitude,
            radiusMeters: 1000,
          }),
        });
      } catch (notificationError) {
        console.error("[report.create] Error dispatching spot notifications", {
          message: notificationError?.message || String(notificationError),
          reportId: newReport?.id || null,
        });
      }
    }

    console.log("[report.create] Report request completed", {
      reportId: newReport?.id || null,
      userId,
      pointsAwarded: pointsToAward,
      deduplicated: wasDuplicateSubmission,
    });
    return Response.json({
      success: true,
      report: applyEffectiveReportExpiry({
        ...newReport,
        latitude: normalizedLatitude,
        longitude: normalizedLongitude,
      }),
      zone,
      pointsAwarded: pointsToAward,
      deduplicated: wasDuplicateSubmission,
      userTrustScore,
    });
  } catch (error) {
    console.error("[report.create] Error reporting spot", {
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
