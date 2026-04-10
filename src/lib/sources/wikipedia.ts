type WikipediaSearchItem = {
  title?: string;
  snippet?: string;
};

type WikipediaSearchResponse = {
  query?: {
    search?: WikipediaSearchItem[];
  };
};

export async function searchWikipedia(claim: string): Promise<string[]> {
  const query = claim.trim();
  if (!query) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("srsearch", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("srlimit", "3");

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as WikipediaSearchResponse;
    return (data.query?.search ?? [])
      .map((item) => item.snippet?.replace(/<[^>]+>/g, "").trim() ?? "")
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
