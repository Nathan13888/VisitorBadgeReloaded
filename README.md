# Visitor Badge Reloaded ✨
> 02/06/24: DEPRECATED vbr.wocr.tk (Freenom killed the domain... I renewed half a year ago btw). Please use the new domain name!

> 12/03/23: NOTICE - there sill be scheduled downtime between Dec 5th evening and Dec 7 morning due to server room maintainance ;)

> 7/19/23: **Looking for new maintainers!** If interested please submit a PR including "Maintainer" in the title.

> 6/20/23: VBR will be down for several days (shouldn't happen again). Sorry for the inconvenience :/

> 6/04/23: All cached records have been successfully restored!

> 6/03/23: VBR will be **self-hosting Redis**. Since CountAPI seem to be somewhat semi-permanantly broken, many existing badges have lost their count. However I was able to recover over **300k lines of logs**, so I should be able to reconstruct a relatively accurate count of all the badges accesses within the **past 3 months**

> 5/28/23: It has come to my attention that countapi.xyz has gone down... It's quite unfortunate but it looks like I'll be implementing a new storage backend in the future.
> This will likely be part of a *large rewrite* of VBR. However, for the time being, data would be written to my own locally hosted Redis instance, then regularly backed up by myself. As for the lost data... we will have to live with the out-of-sync counts for the time being, I will work out a method to work out the count discrepancies in the future.

> 12/06/22: UPDATED HOSTING!!! Please use vbr.wocr.tk instead of the old Heroku domain ([more details below]())


![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&color=55acb7&style=for-the-badge&logo=Github)

<!-- TODO: host this with VBR too -->
[![](https://goreportcard.com/badge/github.com/Nathan13888/VisitorBadgeReloaded)](https://goreportcard.com/report/github.com/Nathan13888/VisitorBadgeReloaded)
[![](https://img.shields.io/badge/License-MIT%202.0-blue.svg)](https://github.com/Nathan13888/VisitorBadgeReloaded/blob/master/LICENSE)
[![Coverage Status](https://coveralls.io/repos/github/Nathan13888/VisitorBadgeReloaded/badge.svg?branch=master)](https://coveralls.io/github/Nathan13888/VisitorBadgeReloaded?branch=master)
![](https://img.shields.io/github/issues-raw/Nathan13888/VisitorBadgeReloaded?label=Issues)
![](https://img.shields.io/github/issues-closed-raw/Nathan13888/VisitorBadgeReloaded?label=Closed+Issues)
![](https://img.shields.io/github/issues-pr-raw/Nathan13888/VisitorBadgeReloaded?label=Open+PRs)
![](https://img.shields.io/github/issues-pr-closed-raw/Nathan13888/VisitorBadgeReloaded?label=Closed+PRs)

**Visitor Badge Reloaded** is a project inspired by [visitor-badge](https://github.com/jwenjian/visitor-badge) which is __no longer maintained__, unfortunately.

In addition, it was missing some features which made it feel incomplete to me. It was also written using Python which I'm personally not a huge fan of, especially when used as a REST api.

Hence, something of **better performance** and **functionality** *must* be made!

---

<!-- TODO: update comparison -->
## 📊 VBR vs [Visitor-Badge](https://github.com/jwenjian/visitor-badge)
|   | VBR | Visitor-Badge |
--- | --- | ---
| **Programming Language** | Golang | Python |
| **Performance** | Badges are generated **completely** locally (both Redis, Shields.io are hosted in GCP) | Flask, Depends on third-party API for storage 🤔 |
| **Features** | Many badges to customize. Basically all things customizable through Shields.io.  | Simple visitor badge. |
| **Potential downtime?** | Nope, as long as Heroku is up. | Glitch instance may reach a request limit 😢 |
| **Self hosting friendly?** | Supports Docker (and Helm chart WIP). There are clear instructions and I am always open to help! | Start script and source available. No instructions in README. |
| **Development?** | Semi-frequent updates and refreshes. PRs and issues are regularly reviewed and addressed. | Not currently (according to owner himself) |

- **direct replacement** (refer to [Migrating From Visitor Badge](#migrating-from-visitor-badge))
- (almost) fully customizable badge

## 🏎️ Benchmarks
*coming soon...*

## ⚙️ Settings/Configuration
### Defaults
- Colour: "blue"
- Style: "square"
- Text: "Visitors"
- Logo: *no logo*
- Cache: *disabled*
- Hit: *enabled*

### Options (NEW Section)

To use the options, **append** these flags to the URL of the badge!

| Option          | Flag        |Description |
---               | ---         | ---
| **Colour**      | `&color=<hex>` | Changes the colour of the embedded logo on the **right-side** of the badge. |
| **Label Colour**| `&lcolor=<hex>` | Changes the colour of the embedded logo on the **left-side** of the badge. |
| **Style**       | `&style=<style>` | Sets the badge style based on **Sheild.io's** option. |
| **Text**        | `&text=<format>` | Allows a **custom string format** to be set. Replaces `CNT` with the view count. |
| **Label**       | `&label=<label>` | Replaces the label with a custom one. |
| **Logo**        | `&logo=<logo name>` | Adds a logo to the badge (refer to examples). Find the logo name from [**Simple Icons**](https://simpleicons.org/) |
| **Logo Colour** | `&lcolor=<hex>` | Changes the colour of the embedded logo on the **left-side** of the badge. |
| **cache** (deprecated) | `&cache=<anything here>` | **Disabled** by default. Changes the caching behaviour of the count by setting a time out. This works *very* poorly with Github's Camo CDN if enabled (since Camo doesn't respect the expiry headers unless it's expired). If the flag `&cache=` is followed by any text (anything more than one character), caching is **enabled**. |
| **hit**         | `&hit=off` | **Enabled** by default. Determines if the badge will update the count (useful for duplicated badges or badges for just viewing the count). If left *empty*, it will update the count on each view. Any setting that is **non-empty (isn't `true` or `yes`**) is considered **disabled**. |

> ***Coming soon***: Support for (all) options in shields.io badges

### Examples 🧪

<!-- TODO: invisible badge option, cache?? logo, logo colour, custom text -->

#### Different text background

![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&color=590d22&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&color=a4133c&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&color=ff4d6d&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&color=ffb3c1&style=for-the-badge&logo=Github&hit=false)

#### Different label background

![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=590d22&color=555555&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=a4133c&color=555555&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=ff4d6d&color=555555&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=ffb3c1&color=555555&style=for-the-badge&logo=Github&hit=false)

#### Different style

![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=590d22&color=555555&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=a4133c&color=555555&style=plastic&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=ff4d6d&color=555555&style=flat&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=ffb3c1&color=555555&style=flat-square&logo=Github&hit=false)

#### Different text

![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&text=Visitors&lcolor=590d22&color=555555&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&text=Fans&lcolor=a4133c&color=555555&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&text=Lovers&lcolor=ff4d6d&color=555555&style=for-the-badge&logo=Github&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&text=Workers&lcolor=ffb3c1&color=555555&style=for-the-badge&logo=Github&hit=false)

#### Different logo

![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=fff&color=000&style=for-the-badge&logo=Github&logoColor=181717&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=000&color=fff&style=for-the-badge&logo=Canva&logoColor=00C4CC&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=000&color=fff&style=for-the-badge&logo=4chan&logoColor=006600&hit=false)
![](https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&lcolor=000&color=fff&style=for-the-badge&logo=Snapchat&logoColor=FFFC00&hit=false)

## 🚢 Migrating From Visitor Badge
```
TLDR; REPLACE THE DOMAIN NAME
ie. 'visitor-badge.glitch.me/badge?page_id=YOURPAGEID' --> 'https://vbr.nathanchung.dev/badge?page_id=YOURPAGEID'
```
**Visitor Badge Reloaded** has ALL the same features as the original [Visitor Badge](https://github.com/jwenjian/visitor-badge) with EVEN MORE FEATURES!

This means that all you have to do is replace the __url__ of the badge with `https://vbr.nathanchung.dev/badge?page_id=<your own page_id here>`. The total visits will remain the **exact same** as well!

Also, **VBR features could be configured as a [HTTP query parameter](https://en.wikipedia.org/wiki/Query_string)**!

### Options (Old Option) (add as a [HTTP query parameter](https://en.wikipedia.org/wiki/Query_string)) 👀
**IMPORTANT: Other than the `page_id` option, there exists additional styling options and functional options (in the future). More details about the options could be found at the bottom of the [Shields.io website](https://shields.io/). Also, all the options are specified as HTTP parameters!!!**
- `page_id=<your id>` --> identifies your badge, make this unique to yourself. eg. `<your username.visitor.badge.reloaded` or `<username>-<username>`
- `color=<colour here>` --> the hex colour of the text background, **do NOT include the `#`**
- `lcolor=<colour here>` --> the hex colour of the label background, **do NOT include the `#`**
- `style=<style name>` --> refer to the Sheilds.IO website for the available options
- `text=<Some text other than "Visitors">` --> put a customizable label on your badge
- `logo` --> logo to put beside the badge, go to https://simpleicons.org/ for the available names
- `logoColor` --> refer to `color` for the formatting
- `cache` --> *just put `&cache=on` at the end of the badge url

## 🚀 Feature Roadmap
- Deployment
  - [ ] K8S support (Helm charts)
  - [ ] High availability (stateless)
  - [ ] Upgraded Shields.io
  - [ ] Automated scheduled backups: badge count,
- API Improvements
  - [ ] Rate limiting, Prevent Abuse
  - [ ] /health, /healthz endpoints
  - [ ] Improved /status information.
  - [ ] Uptime Monitoring
- Code base
  - [ ] Refactor code base
  - [ ] Complete TODO comments
  - [ ] Deprecate "Bigcache"
- New Website
  - [ ] Personalized Analytics About Visitors
  - [ ] Automated import from other projects

## 🥳 Supporting this project!
I originally created this project because I personally wanted something that was built to my (relatively high) expectations of performance and customizability. I share this project and its hosted service to the public as I thought that this would be something that would benefit others. However, __maintaining such a project__ and __handling the demands of all the users that would use this service__ would incur additional work and costs for myself. Hence, it would be **greatly** appreciated if you could support this project by the following ways:
1. **Star ⭐ and share** this project!
2. **Contribute** to the development. Refer to [Contributing](#Contributing)
3. **Bug tracking!** If you find any issues, please create an Issue so the problem could be fixed as soon as possible.

## 📦 Deploying your own instance (self-hosting)
If at any point, you feel the need to host your own instace, you could refer to the following information to do so. I personally don't believe in such a need but you are welcome to do so.

### Docker/Kubernetes
This app could be packaged as a Docker image. Prebuilt docker images of VBR are also available on Docker Hub and on the Github Container Registry. __Just run the relevant commands found in the [**Makefile**](Makefile)__. Then deploy to your choosen cloud service or even to your own server. However, note that there is no HTTPS support and VBR should be placed behind something else that provides HTTPS (eg. reverse proxy, Heroku...).

### Heroku (Deprecated)

> NOTE: Untested for new versions of Heroku dynos. But feel free to submit a PR or issue/request if something doesn't work.
> Please note that Heroku will no longer offer free dynos starting November 28, 2022!

Documentation for deploying Docker is found [here](https://devcenter.heroku.com/articles/build-docker-images-heroku-yml). **All the files necessary to deploy to Heroku is already present** within the repository so this should be rather trivial. In addition `make deploy-heroku` pushes the git repo to the `heroku` remote if you have configured Heroku already.

You could also deploy to heroku using this widget (thanks to [rzlamrr](https://github.com/rzlamrr) for the PR):

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## 💻 Software Used
- Golang
- Docker
- Mux (router)
- Zerolog (logger)
- Redis (Cache and Database)
- shields.io

