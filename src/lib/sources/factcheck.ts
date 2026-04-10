type FactCheckReview = {
  textualRating?: string;
  publisher?: {
    name?: string;
  };
  url?: string;
};

type FactCheckClaim = {
  claimReview?: FactCheckReview[];
};

type FactCheckResponse = {
  claims?: FactCheckClaim[];
};

function getFactCheckApiKey(): string | null {
  return process.env.GOOGLE_FACTCHECK_KEY ?? process.env.GOOGLE_FACTCHECK_API_KEY ?? null;
}

export async function checkFacts(
  claim: string
): Promise<{ rating: string; source: string; url: string } | null> {
  const query = claim.trim();
  if (!query) {
    return null;
  }

  const apiKey = getFactCheckApiKey();
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const endpoint = new URL("https://factchecktools.googleapis.com/v1alpha1/claims:search");
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("key", apiKey);

    const response = await fetch(endpoint.toString(), {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as FactCheckResponse;
    const review = data.claims?.[0]?.claimReview?.[0];
    if (!review) {
      return null;
    }

    return {
      rating: review.textualRating?.trim() || "unrated",
      source: review.publisher?.name?.trim() || "Google Fact Check",
      url: review.url?.trim() || ""
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
