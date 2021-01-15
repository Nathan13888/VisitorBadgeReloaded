# Visitor Badge Reloaded

![](https://visitor-badge-reloaded.herokuapp.com/badge?page_id=visitor-badge-reloaded-visitors&color=232323&style=for-the-badge&logo=Github)

[![](https://goreportcard.com/badge/github.com/Nathan13888/VisitorBadgeReloaded)](https://goreportcard.com/report/github.com/Nathan13888/VisitorBadgeReloaded)
[![](https://img.shields.io/badge/License-MIT%202.0-blue.svg)](https://github.com/gojp/goreportcard/blob/master/LICENSE)
[![Coverage Status](https://coveralls.io/repos/github/Nathan13888/VisitorBadgeReloaded/badge.svg?branch=master)](https://coveralls.io/github/Nathan13888/VisitorBadgeReloaded?branch=master)

**Visitor Badge Reloaded** is a recreation of the the popular [visitor-badge](https://github.com/jwenjian/visitor-badge) which is __no longer maintained__, unfortunately. In addition, it was missing some features which made it feel incomplete to me. It was also written using Python which I'm personally not a huge fan of; especially the performance.

*There is a similar project made by ESKYoung who forked the project and implemented other features before to customize the badge found [here](https://github.com/ESKYoung/shields-io-visitor-counter)*

---

## Features
- **direct replacement** (refer to `Migrating From Visitor Badge`)
- customizable badge: colour, style, text, logo

## Defaults
- Colour: "blue"
- Style: "square"
- Text: "Visitors"
- Logo: *no logo*

## Migrating From Visitor Badge
*Since **Visitor Badge Reloaded** was made to have all the same features as the original Visitor Badge with extra, even the format of the badges are exact same. This means that all you have to do is replace the __url__ of the badge with `https://visitor-badge-reloaded.herokuapp.com/badge?page_id=<your own page_id here>`. The total visits will remain the **exact same** as well.*

## Settings/Configuration
### Examples
``
``
``
### Options
**IMPORTANT: Other than the `page_id` option, there exists additional styling options and functional options (in the future). More details about the options could be found at the bottom of the [Shields.io website](https://shields.io/). Also, all the options are specified as HTTP parameters!!!**
- `page_id=<your id>` --> identifies your badge, make this unique to yourself. eg. `<your username.visitor.badge.reloaded` or `<username>-<username>`
- `&color=<colour here>` --> the hex colour code of your badge, **do NOT include the `#`**
- `&style=<style name>` --> refer to the Sheilds.IO website for the available options
- `&text=<Some text other than "Visitors">` --> put a customizable label on your badge
- `&logo` --> logo to put beside the badge, go to https://simpleicons.org/ for the available names
- `&logoColor` --> refer to `color` for the formatting

## Deploying your own instance
If at any point, you feel the need to host your own instace, you could refer to the following information to do so. I personally don't believe in such a need as of this point but you are welcome to do so.
### Docker/Kubernetes
This app could be packaged as a Docker image. __Just run the relevant commands found in the `Makefile`__. Then deploy to your choosen cloud service or even to your own server. However, note that there is no HTTPS support out of the box as the SSL cert actually just comes from Heroku's site-wide cert.
### Heroku (recommended)
Heroku supports Docker containers even with their free instances. __The current public instance of the app is deployed there as well.__ Documentation is found [here](https://devcenter.heroku.com/articles/build-docker-images-heroku-yml). All the files necessary to deploy to Heroku is already present with the repository __so this should be rather trivial__. In addition `make deploy-heroku` just pushes the git repo to the `heroku` remote if you have configured Heroku already.
### OTHER
**IF you have tried any other method of deploying this app elsewhere such as on Glitch or some other Cloud Platform, please send __pull requests__ on your experience so others could benefit from it, that would be greatly appreciated.**

## "Stuff" Used
- Golang
- shields.io badges
- Docker

## TODO (organized in order of highest priority)
- website homepage
- more configurable settings and better logging capabilities
- self-hosted database for caching (Redis probably)
- more crytopgraphically secure hashing (configurable)
- analytics??
- differentiates user by IP
- differentiates user by Github account???
- __*additional TODOs are in the code itself*__

## Contribution
If you are interested in helping make this project better, I highly welcome you to do so. I thank you in advance for your interest. If you are unsure of what you could do to improve the project, you may have a look in TODO list (above), or add to the list yourself
