# Visitor Badge Reloaded

> 12/06/22: UPDATED HOSTING!!! Please use vbr.wocr.tk instead of the old Heroku domain ([more details below]())


![](https://vbr.wocrk.tk/badge?page_id=visitor-badge-reloaded-visitors&color=55acb7&style=for-the-badge&logo=Github)

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

## VBR vs [Visitor-Badge](https://github.com/jwenjian/visitor-badge)
|   | VBR | Visitor-Badge |
--- | --- | ---
| **Programming Language** | Golang | Python |
| **Performance** | Arguably better? Mux router is quick at matching and generation functions are optimized. Caching is available as well. | Flask... 🤔 |
| **Features** | There are many additional features for customizability... | Select your page_id? |
| **Potential downtime?** | Nope, as long as Heroku is up. | Glitch instance may reach a request limit 😢 |
| **Self hosting friendly?** | There are instructions and I am always open to help! | Questionable documentation? |
| **Maintained and under development?** | Yes... | No, according to owner himself |
| **Source code is readible?** | Maybe not? | One file but not much better for readibility |

- **direct replacement** (refer to [Migrating From Visitor Badge](#migrating-from-visitor-badge))
- (almost) fully customizable badge

## Benchmarks
*coming soon...*

## Settings/Configuration
### Defaults
- Colour: "blue"
- Style: "square"
- Text: "Visitors"
- Logo: *no logo*
- Cache: *disabled*

### Examples
- 

## Migrating From Visitor Badge
```
TLDR; REPLACE THE DOMAIN NAME
ie. 'visitor-badge.glitch.me/badge?page_id=YOURPAGEID' --> 'https://vbr.wocr.tk/badge?page_id=YOURPAGEID'
```
**Visitor Badge Reloaded** has ALL the same features as the original [Visitor Badge](https://github.com/jwenjian/visitor-badge) with EVEN MORE FEATURES!

This means that all you have to do is replace the __url__ of the badge with `https://vbr.wocr.tk/badge?page_id=<your own page_id here>`. The total visits will remain the **exact same** as well!

Also, **VBR features could be configured as a [HTTP query parameter](https://en.wikipedia.org/wiki/Query_string)**!

### Options (add as a [HTTP query parameter](https://en.wikipedia.org/wiki/Query_string))
**IMPORTANT: Other than the `page_id` option, there exists additional styling options and functional options (in the future). More details about the options could be found at the bottom of the [Shields.io website](https://shields.io/). Also, all the options are specified as HTTP parameters!!!**
- `page_id=<your id>` --> identifies your badge, make this unique to yourself. eg. `<your username.visitor.badge.reloaded` or `<username>-<username>`
- `color=<colour here>` --> the hex colour of the text background, **do NOT include the `#`**
- `lcolor=<colour here>` --> the hex colour of the label background, **do NOT include the `#`**
- `style=<style name>` --> refer to the Sheilds.IO website for the available options
- `text=<Some text other than "Visitors">` --> put a customizable label on your badge
- `logo` --> logo to put beside the badge, go to https://simpleicons.org/ for the available names
- `logoColor` --> refer to `color` for the formatting
- `cache` --> *just put `&cache=on` at the end of the badge url

## Deploying your own instance
If at any point, you feel the need to host your own instace, you could refer to the following information to do so. I personally don't believe in such a need but you are welcome to do so.

### Docker/Kubernetes
This app could be packaged as a Docker image. Prebuilt docker images of VBR are also available on Docker Hub and on the Github Container Registry. __Just run the relevant commands found in the `Makefile`__. Then deploy to your choosen cloud service or even to your own server. However, note that there is no HTTPS support and VBR should be placed behind something else that provides HTTPS (eg. reverse proxy, Heroku...).

### Heroku

> Please note that Heroku will no longer offer free dynos starting November 28, 2022!

Documentation for deploying Docker is found [here](https://devcenter.heroku.com/articles/build-docker-images-heroku-yml). **All the files necessary to deploy to Heroku is already present** within the repository so this should be rather trivial. In addition `make deploy-heroku` pushes the git repo to the `heroku` remote if you have configured Heroku already.

You could also deploy to heroku using this widget (thanks to [rzlamrr](https://github.com/rzlamrr) for the PR):

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## "Stuff" Used
- Golang
- Docker
- Mux (router)
- Zerolog (logger)
- shields.io

## TODO
- **GOT FEATURE REQUEST???** __Send me an issue!__
- website homepage
- local badge generator (instead of relaying shields.io)
- differentiates user by IP
- differentiates user by Github account???
- user analytics??
- __*additional TODOs are in the code itself*__

## Supporting this project!
I originally created this project because I personally wanted something that was built to my (relatively high) expectations of performance and customizability. I share this project and its hosted service to the public as I thought that this would be something that would benefit others. However, __maintaining such a project__ and __handling the demands of all the users that would use this service__ would incur additional work and costs for myself. Hence, it would be **greatly** appreciated if you could support this project by the following ways:
1. **Star ⭐ and share** this project!
2. **Contribute** to the development. Refer to [Contributing](#Contributing)
3. **Bug tracking!** If you find any issues, please create an Issue so the problem could be fixed as soon as possible.

## Contributing
If you are interested in helping make this project better, I highly welcome you to do so. I thank you in advance for your interest. If you are unsure of what you could do to improve the project, you may have a look in TODO list (above), or add to the list yourself
