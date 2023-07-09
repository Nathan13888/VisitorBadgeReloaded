# IMAGE: VBR BUILDER
FROM golang:1.18-alpine as builder
WORKDIR /build
COPY . .
RUN apk add make
RUN make build

# IMAGE: CONTAINER
FROM alpine:latest
WORKDIR /app

## TIMEZONE
RUN apk add --no-cache tzdata nodejs bash
RUN cp /usr/share/zoneinfo/America/Toronto /etc/localtime

## Heroku Exec
RUN apk add --no-cache curl openssh python3
COPY --from=builder /build/heroku-exec.sh /app/.profile.d/heroku-exec.sh
# RUN rm /bin/sh && ln -s /bin/bash /bin/sh

## Copy binary
COPY --from=builder /build/bin/vbr /app/vbr

EXPOSE 8080/tcp

CMD /bin/bash .profile.d/heroku-exec.sh && /app/vbr
