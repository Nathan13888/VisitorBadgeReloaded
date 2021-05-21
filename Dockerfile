# IMAGE: BUILDER
FROM golang:1.16-alpine as builder
WORKDIR /build
COPY . .
RUN apk add make
RUN make build

# IMAGE: CONTAINER
FROM alpine:latest
WORKDIR /app

# ENV VARIABLES

## TIMEZONE
RUN apk add tzdata
RUN cp /usr/share/zoneinfo/America/Toronto /etc/localtime

COPY --from=builder /build/bin/vbr /app/vbr

CMD [ "/app/vbr" ]

