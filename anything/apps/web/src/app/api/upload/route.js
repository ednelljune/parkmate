import upload from "@/app/api/utils/upload";

const normalizeBase64Payload = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const dataUrlMatch = trimmedValue.match(/^data:[^;]+;base64,(.+)$/);
  if (dataUrlMatch?.[1]) {
    return dataUrlMatch[1];
  }

  return trimmedValue;
};

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return Response.json(
        { error: "Unsupported upload content type." },
        { status: 415 },
      );
    }

    const { base64, url } = await request.json();
    const normalizedBase64 = normalizeBase64Payload(base64);

    if (!normalizedBase64 && !url) {
      return Response.json(
        { error: "Upload requires a base64 payload or URL." },
        { status: 400 },
      );
    }

    const result = await upload({ base64: normalizedBase64, url });

    return Response.json(result);
  } catch (error) {
    console.error("Upload API error:", error);
    return Response.json(
      { error: error.message || "Upload failed" },
      { status: 500 },
    );
  }
}
