// Secrets are not declared in wrangler.toml, so `wrangler types` does not
// generate them. Merged into the generated Env interface.
interface Env {
  /**
   * Secret used to derive per-badge, per-day visitor hashing keys.
   *
   * Set with `wrangler secret put VISITOR_HASH_KEY`. When unset, the estimated
   * unique visitor metric is skipped and reported as null; hit counting is
   * unaffected. Rotating it resets only the current day's estimate, since
   * earlier days are already frozen to plain integers.
   */
  VISITOR_HASH_KEY?: string;
}
