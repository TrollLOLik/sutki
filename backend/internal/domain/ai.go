package domain

import "context"

type AISummarizer interface {
	GenerateReviewsSummary(ctx context.Context, reviews []string) (string, error)
	GenerateLocationSummary(ctx context.Context, city, street, district string, pois []HousePOI) (string, error)
}
