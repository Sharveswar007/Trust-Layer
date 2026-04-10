type SerperOrganicResult = {
  snippet?: string;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
};

export async function searchWeb(claim: string): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey || !claim.trim()) {
    return [];
  }

  const normalizedQuery = claim
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

  if (!normalizedQuery) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey
      },
      body: JSON.stringify({ q: normalizedQuery }),
      signal: controller.signal
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as SerperResponse;
    return (data.organic ?? [])
      .map((item) => item.snippet?.trim() ?? "")
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
