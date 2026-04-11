const DEFAULT_VERIFY_PATH = "/api/verify";

export function getVerifyApiUrl(path = DEFAULT_VERIFY_PATH): string {
  const baseUrl = process.env.NEXT_PUBLIC_VERIFY_API_BASE_URL?.trim();

  if (!baseUrl) {
    return path;
  }

  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}