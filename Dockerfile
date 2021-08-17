# IMAGE: VBR BUILDER
FROM golang:1.17-alpine as builder
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
RUN apk add tzdata
RUN apk add nodejs
RUN apk add bash
RUN cp /usr/share/zoneinfo/America/Toronto /etc/localtime

COPY --from=builder /build/bin/vbr /app/vbr
COPY --from=builder /build/docker-wrapper.sh /app/docker-wrapper.sh

COPY --from=shields /usr/src/app /app/shields

EXPOSE 8080/tcp
EXPOSE 9090/tcp

CMD [ "/bin/bash", "docker-wrapper.sh" ]
