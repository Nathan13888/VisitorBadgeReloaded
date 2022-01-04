# IMAGE: VBR BUILDER
FROM golang:1.16-alpine as builder
WORKDIR /build
COPY . .
RUN apk add make
RUN make build

# IMAGE: SHIELDS.IO
FROM shieldsio/shields:server-2021-05-01 as shields

# IMAGE: CONTAINER
FROM alpine:latest
MAINTAINER Nathan13888
WORKDIR /app

# ENV VARIABLES
# TODO
ENV LOCAL_SHIELDS ENABLED
ENV DEBUG DISABLED
ENV NODE_ENV production

## TIMEZONE
RUN apk add --no-cache tzdata nodejs bash
RUN cp /usr/share/zoneinfo/America/Toronto /etc/localtime

COPY --from=builder /build/bin/vbr /app/vbr
COPY --from=builder /build/docker-wrapper.sh /app/docker-wrapper.sh

## Heroku Exec
RUN apk add --no-cache curl openssh python3
COPY --from=builder /build/heroku-exec.sh /app/.profile.d/heroku-exec.sh
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

COPY --from=shields /usr/src/app /app/shields

EXPOSE 8080/tcp
EXPOSE 9090/tcp

CMD /bin/bash .profile.d/heroku-exec.sh && /bin/bash docker-wrapper.sh
