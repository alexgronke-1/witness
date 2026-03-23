export async function POST(request) {
  try {
    const body = await request.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: { message: "ANTHROPIC_API_KEY is not set" } }, { status: 500 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    try {
      const data = JSON.parse(text);
      return Response.json(data, { status: res.status });
    } catch {
      return Response.json({ error: { message: `Anthropic returned non-JSON: ${text.slice(0, 200)}` } }, { status: 500 });
    }
  } catch (e) {
    return Response.json({ error: { message: e.message } }, { status: 500 });
  }
}
