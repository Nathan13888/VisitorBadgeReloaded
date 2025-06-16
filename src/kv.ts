import { hashPageId } from "./util";

// Fetch page id count without modification
export const page_id_fetch = async (
  kv: KVNamespace<string>,
  pageId: string
): Promise<string> => {
  const hash = await hashPageId(pageId);

  const value = await kv.get(hash, "text");
  return value ?? "0";
};

// Fetch page id count and increment it by one
export const page_id_fetch_add_one = async (
  kv: KVNamespace<string>,
  pageId: string
): Promise<string> => {
  const hash = await hashPageId(pageId);

  const value = await kv.get(hash, "text");
  if (value === null) {
    await kv.put(hash, "1", { expirationTtl: 60 * 10 });
    return "1";
  }
  const count = Number.parseInt(value, 10);
  if (Number.isNaN(count)) {
    console.error(`Failed to parse ${pageId}: ${value}`);
    return "-1";
  }
  const newCount = count + 1;
  await kv.put(hash, newCount.toString());

  return newCount.toString();
};
