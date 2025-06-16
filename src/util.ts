import { md5 } from "hono/utils/crypto";

export const hashPageId = async (pageId: string): Promise<string> => {
  const data = new TextEncoder().encode(`${pageId}guess_what`);

  const hash = (await md5(data)) ?? "";

  return hash;
};
