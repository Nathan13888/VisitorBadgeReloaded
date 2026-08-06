# Changelog

08/05/26: Rewrote rate limiting and made uncounted badges cacheable. Rate limiting was keyed on the badge rather than on the caller, so it throttled popular badges while an abusive client only had to rotate `page_id`s to get an unlimited budget. Worse, it was implemented on Durable Object storage and wrote on every request, so a single request for an invented `page_id` permanently created storage - rotating IDs was the one thing it was supposed to stop and the one thing it made expensive. It now uses Cloudflare's rate limiting binding, which stores nothing, and is keyed per client. Exceeding the limit on a counted view no longer produces an error badge: the badge renders normally and the view simply is not counted, so a rate limit can never turn a README into a broken image. `&hit=false` badges are now cached for 15 seconds and no longer touch storage at all, and differently styled badges for one `page_id` share a single count lookup. Counted badges are still never cached, or a cache could answer GitHub Camo and swallow the view. `page_id` is now capped at 256 characters. The `&cache=` and `&unique=` options are gone; neither ever worked - `&cache=` was documented but never read, and `&unique=` was rejected by validation before reaching the code that used it.

08/05/26: Badges are now rendered inside the Worker instead of being proxied from shields.io. Rendering uses `badge-maker`, the library Shields itself renders with, and the full Simple Icons set is bundled alongside it, so serving a badge no longer makes any request outside Cloudflare. Output is byte-identical to what shields.io returned for the same options. Logo names resolve the way Shields resolves them - canonical slug (`googlechrome`), icon title with spaces as dashes (`google-chrome`), and Shields' legacy aliases - plus Simple Icons' own aliases, which Shields ignores. Two things that previously rendered a "404: badge not found" image now render properly: an empty `&text=`, and a `&color=`/`&text=` containing a single dash.

08/05/26: Removed raw IP retention from badge analytics. Visitor addresses were previously kept in Durable Object storage as part of the unique visitor set; that data is now deleted the first time each badge is loaded and is never written again. The "Unique Visitors" metric is replaced by an estimated daily unique visitor count (~6.5% margin of error), computed from a HyperLogLog sketch. Addresses are hashed with a per-badge, per-day key derived from a Worker secret and recomputed on every request, so no key and nothing address-derived is ever persisted. Only the current day's registers are retained; earlier days are frozen to plain integers. Self-hosters must set `VISITOR_HASH_KEY` — see the README.

10/25/25: Implemented rate limiting.

10/19/25: Migrated from Cloudflare KV to DO for storage backend

10/19/25: New website at <https://vbr.nathanchung.dev>

06/16/25: Migrated to Cloudflare Workers

11/20/24: Refactoring to ~~Rust 🦀...~~Typescript

02/06/24: DEPRECATED vbr.wocr.tk (Freenom killed the domain... I renewed half a year ago btw). Please use the new domain name!

12/03/23: NOTICE - there sill be scheduled downtime between Dec 5th evening and Dec 7 morning due to server room maintainance ;)

7/19/23: **Looking for new maintainers!** If interested please submit a PR including "Maintainer" in the title.

6/20/23: VBR will be down for several days (shouldn't happen again). Sorry for the inconvenience :/

6/04/23: All cached records have been successfully restored!

6/03/23: VBR will be **self-hosting Redis**. Since CountAPI seem to be somewhat semi-permanantly broken, many existing badges have lost their count. However I was able to recover over **300k lines of logs**, so I should be able to reconstruct a relatively accurate count of all the badges accesses within the **past 3 months**

5/28/23: It has come to my attention that countapi.xyz has gone down... It's quite unfortunate but it looks like I'll be implementing a new storage backend in the future.
This will likely be part of a _large rewrite_ of VBR. However, for the time being, data would be written to my own locally hosted Redis instance, then regularly backed up by myself. As for the lost data... we will have to live with the out-of-sync counts for the time being, I will work out a method to work out the count discrepancies in the future.

12/06/22: UPDATED HOSTING!!! Please use vbr.wocr.tk instead of the old Heroku domain ([more details below]())
