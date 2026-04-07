export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input");

    if (!input || input.length < 3) {
      return Response.json({ predictions: [] });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Google Maps API key is not configured on the server." },
        { status: 500 },
      );
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`,
    );

    const data = await response.json();

    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error("Error fetching autocomplete:", error);
    return Response.json(
      { predictions: [], error: error?.message || "Unknown error" },
      { status: 500 },
    );
  }
}
