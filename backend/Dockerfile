FROM golang:1.26.4-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/wigaj-arenda-api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/wigaj-arenda-api /wigaj-arenda-api

EXPOSE 8080

ENTRYPOINT ["/wigaj-arenda-api"]
