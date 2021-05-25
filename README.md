# Visitor Badge Reloaded

![](https://visitor-badge-reloaded.herokuapp.com/badge?page_id=visitor-badge-reloaded-visitors&color=55acb7&style=for-the-badge&logo=Github)

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
- **direct replacement** (refer to [Migrating From Visitor Badge](#migrating-from-visitor-badge)
- (almost) fully customizable badge

## Benchmarks
*coming soon...*

## Migrating From Visitor Badge
```
TLDR; REPLACE THE DOMAIN NAME
ie. 'visitor-badge.glitch.me/badge?page_id=YOURPAGEID' --> 'visitor-badge-reloaded.herokuapp.com/badge?page_id=YOURPAGEID'
```
**Visitor Badge Reloaded** has ALL the same features as the original [Visitor Badge](https://github.com/jwenjian/visitor-badge) with EVEN MORE FEATURES!

This means that all you have to do is replace the __url__ of the badge with `https://visitor-badge-reloaded.herokuapp.com/badge?page_id=<your own page_id here>`. The total visits will remain the **exact same** as well!

Also, **VBR features could be configured as a [HTTP query parameter](https://en.wikipedia.org/wiki/Query_string)**!

## Settings/Configuration
### Defaults
- Colour: "blue"
- Style: "square"
- Text: "Visitors"
- Logo: *no logo*
- Cache: *disabled*

### Examples


### Options (add as
**IMPORTANT: Other than the `page_id` option, there exists additional styling options and functional options (in the future). More details about the options could be found at the bottom of the [Shields.io website](https://shields.io/). Also, all the options are specified as HTTP parameters!!!**
- `page_id=<your id>` --> identifies your badge, make this unique to yourself. eg. `<your username.visitor.badge.reloaded` or `<username>-<username>`
- `color=<colour here>` --> the hex colour code of your badge, **do NOT include the `#`**
- `style=<style name>` --> refer to the Sheilds.IO website for the available options
- `text=<Some text other than "Visitors">` --> put a customizable label on your badge
- `logo` --> logo to put beside the badge, go to https://simpleicons.org/ for the available names
- `logoColor` --> refer to `color` for the formatting
- `cache` --> *just put `&cache=on` at the end of the badge url

## Deploying your own instance
If at any point, you feel the need to host your own instace, you could refer to the following information to do so. I personally don't believe in such a need but you are welcome to do so.

### Docker/Kubernetes
This app could be packaged as a Docker image. Prebuilt docker images of VBR are also available on Docker Hub and on the Github Container Registry. __Just run the relevant commands found in the `Makefile`__. Then deploy to your choosen cloud service or even to your own server. However, note that there is no HTTPS support and VBR should be placed behind something else that provides HTTPS (eg. reverse proxy, Heroku...).

### Heroku (recommended)
Heroku supports Docker containers even with their free dynos. __The current public instance of the app is deployed there as well. __Documentation for deploying Docker is found [here](https://devcenter.heroku.com/articles/build-docker-images-heroku-yml). **All the files necessary to deploy to Heroku is already present** within the repository __so this should be rather trivial__. In addition `make deploy-heroku` pushes the git repo to the `heroku` remote if you have configured Heroku already.

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

## Contributing
If you are interested in helping make this project better, I highly welcome you to do so. I thank you in advance for your interest. If you are unsure of what you could do to improve the project, you may have a look in TODO list (above), or add to the list yourself
