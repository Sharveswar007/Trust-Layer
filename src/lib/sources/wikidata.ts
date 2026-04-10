type WikidataBindingValue = {
  value?: string;
};

type WikidataBinding = {
  item?: WikidataBindingValue;
  itemLabel?: WikidataBindingValue;
  itemDescription?: WikidataBindingValue;
  countryLabel?: WikidataBindingValue;
  inception?: WikidataBindingValue;
  population?: WikidataBindingValue;
};

type WikidataResponse = {
  results?: {
    bindings?: WikidataBinding[];
  };
};

function escapeSparqlLiteral(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").trim();
}

export async function queryWikidata(claim: string): Promise<string | null> {
  const normalized = claim.trim();
  if (!normalized) {
    return null;
  }

  const queryText = escapeSparqlLiteral(normalized.slice(0, 80));
  const sparql = `
SELECT ?item ?itemLabel ?itemDescription ?countryLabel ?inception ?population WHERE {
  ?item rdfs:label ?itemLabel .
  FILTER(LANG(?itemLabel) = "en")
  FILTER(CONTAINS(LCASE(?itemLabel), LCASE("${queryText}")))

  OPTIONAL { ?item wdt:P17 ?country . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P1082 ?population . }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 1
`.trim();

  const endpoint = "https://query.wikidata.org/sparql";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${endpoint}?format=json&query=${encodeURIComponent(sparql)}`, {
      headers: {
        Accept: "application/sparql-results+json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as WikidataResponse;
    const row = data.results?.bindings?.[0];
    if (!row) {
      return null;
    }

    const structured = {
      entity: row.itemLabel?.value ?? null,
      description: row.itemDescription?.value ?? null,
      country: row.countryLabel?.value ?? null,
      inception: row.inception?.value ?? null,
      population: row.population?.value ?? null,
      wikidata_url: row.item?.value ?? null
    };

    return JSON.stringify(structured);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
