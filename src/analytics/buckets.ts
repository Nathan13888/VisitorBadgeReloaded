/**
 * Time bucket keys for the analytics record.
 *
 * Every bucket is UTC and formatted so that lexical order is chronological
 * order, which is what lets the summary sort a day's or an hour's entries with
 * a plain string compare instead of parsing each key back to a timestamp.
 *
 * Formatting and parsing live together deliberately: a key's shape is agreed
 * between the code that writes buckets and the code that expires them, and
 * splitting the two across modules is how those quietly disagree.
 */

/**
 * Hour bucket key for a timestamp (format: YYYY-MM-DD-HH)
 */
export function getHourBucket(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}`;
}

/**
 * Date bucket key for a timestamp (format: YYYY-MM-DD)
 */
export function getDateBucket(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Timestamp at the start of an hour bucket
 */
export function parseHourBucket(bucket: string): number {
  const parts = bucket.split("-");
  return new Date(
    `${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:00:00Z`,
  ).getTime();
}

/**
 * Timestamp at the start of a date bucket
 */
export function parseDateBucket(bucket: string): number {
  return new Date(`${bucket}T00:00:00Z`).getTime();
}
