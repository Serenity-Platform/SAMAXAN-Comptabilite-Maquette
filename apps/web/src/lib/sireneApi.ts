// Paperasse — Client Edge Function compta-sirene-lookup
import { config } from "./config";
import type { SireneApiResponse } from "./types";

export async function lookupSirene(siren: string): Promise<SireneApiResponse> {
  const url = `${config.endpoints.sireneLookup}?siren=${encodeURIComponent(siren)}`;
  try {
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    const data = (await resp.json()) as SireneApiResponse;
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: "client_fetch_failed",
      message: `Impossible de contacter le service : ${message}`,
    };
  }
}
