# Changelog

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
