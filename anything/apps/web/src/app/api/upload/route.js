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

const isSafeUrl = (urlString) => {
  if (typeof urlString !== "string" || !urlString) {
    return false;
  }

  try {
    const url = new URL(urlString);
    
    // Only allow http and https
    if (!url.protocol.match(/^https?:$/)) {
      return false;
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // Reject localhost and variations
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }
    
    // Reject link-local and loopback addresses
    if (hostname.startsWith("127.") || hostname.startsWith("169.254.") || hostname.startsWith("::ffff:127.")) {
      return false;
    }
    
    // Reject cloud metadata addresses
    if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
      return false;
    }
    
    // Reject private IP ranges (simple check)
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.startsWith("172.")) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
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

    // Validate URL if provided
    if (url && !isSafeUrl(url)) {
      return Response.json(
        { error: "Invalid or unsafe URL provided." },
        { status: 400 },
      );
    }

    const result = await upload({ base64: normalizedBase64, url });

    return Response.json(result);
  } catch (error) {
    console.error("Upload API error:", error);
    return Response.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
