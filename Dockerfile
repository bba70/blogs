# syntax=docker/dockerfile:1

FROM golang:1.24-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget \
    && addgroup -S blogs \
    && adduser -S -G blogs blogs

WORKDIR /app
COPY --from=builder /out/server ./server
COPY internal/database/migrations ./internal/database/migrations

USER blogs
EXPOSE 8080

ENTRYPOINT ["/app/server"]
