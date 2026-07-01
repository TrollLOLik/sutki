package storage

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type S3Storage struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucket        string
	publicURL     string
	endpoint      string
	usePathStyle  bool
}

func NewS3Storage(endpoint, presignEndpoint, region, bucket, accessKey, secretKey string, usePathStyle bool, publicURL string) (*S3Storage, error) {
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, reg string, options ...interface{}) (aws.Endpoint, error) {
		if service == s3.ServiceID && endpoint != "" {
			return aws.Endpoint{
				URL:           endpoint,
				SigningRegion: region,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(region),
		config.WithEndpointResolverWithOptions(customResolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load S3 config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = usePathStyle
	})

	// Use separate client/endpoint for presigned URLs if specified
	var presignTargetClient *s3.Client
	if presignEndpoint != "" && presignEndpoint != endpoint {
		presignResolver := aws.EndpointResolverWithOptionsFunc(func(service, reg string, options ...interface{}) (aws.Endpoint, error) {
			if service == s3.ServiceID {
				return aws.Endpoint{
					URL:           presignEndpoint,
					SigningRegion: region,
				}, nil
			}
			return aws.Endpoint{}, &aws.EndpointNotFoundError{}
		})
		presignCfg, err := config.LoadDefaultConfig(context.Background(),
			config.WithRegion(region),
			config.WithEndpointResolverWithOptions(presignResolver),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
		)
		if err == nil {
			presignTargetClient = s3.NewFromConfig(presignCfg, func(o *s3.Options) {
				o.UsePathStyle = usePathStyle
			})
		}
	}

	if presignTargetClient == nil {
		presignTargetClient = client
	}

	// Autocreate the bucket if it does not exist
	_, err = client.HeadBucket(context.Background(), &s3.HeadBucketInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		log.Printf("S3: Bucket %q not found, attempting to create it...", bucket)
		_, cErr := client.CreateBucket(context.Background(), &s3.CreateBucketInput{
			Bucket: aws.String(bucket),
		})
		if cErr != nil {
			isLocal := strings.Contains(endpoint, "127.0.0.1") || strings.Contains(endpoint, "minio")
			if isLocal {
				return nil, fmt.Errorf("failed to create local bucket %q: %w", bucket, cErr)
			}
			log.Printf("S3: Bucket %q could not be auto-created (likely managed by provider): %v", bucket, cErr)
		} else {
			log.Printf("S3: Bucket %q created successfully!", bucket)
		}
	}

	return &S3Storage{
		client:        client,
		presignClient: s3.NewPresignClient(presignTargetClient),
		bucket:        bucket,
		publicURL:     publicURL,
		endpoint:      endpoint,
		usePathStyle:  usePathStyle,
	}, nil
}

func (s *S3Storage) PresignUpload(ctx context.Context, key string, exactBytes int64, contentType string) (domain.UploadTarget, error) {
	// Sign only ContentType in the presigned PUT URL.
	// ContentLength is intentionally NOT signed because mobile clients (React Native XHR)
	// set it automatically based on the real file size on disk, which may differ from the
	// value reported by expo-image-picker (e.g. fileSize=undefined for camera photos).
	// The client already enforces the 15 MB limit before uploading.
	req, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return domain.UploadTarget{}, err
	}

	return domain.UploadTarget{
		URL: req.URL,
		Key: key,
	}, nil
}

func (s *S3Storage) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	req, err := s.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func (s *S3Storage) StatObject(ctx context.Context, key string) (domain.ObjectInfo, error) {
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return domain.ObjectInfo{}, err
	}

	contentType := ""
	if out.ContentType != nil {
		contentType = *out.ContentType
	}

	size := int64(0)
	if out.ContentLength != nil {
		size = *out.ContentLength
	}

	return domain.ObjectInfo{
		SizeBytes:   size,
		ContentType: contentType,
	}, nil
}

func (s *S3Storage) PublicURL(key string) string {
	if s.publicURL != "" {
		return fmt.Sprintf("%s/%s", strings.TrimRight(s.publicURL, "/"), key)
	}

	base := strings.TrimRight(s.endpoint, "/")
	if s.usePathStyle {
		return fmt.Sprintf("%s/%s/%s", base, s.bucket, key)
	}

	proto := ""
	host := base
	if idx := strings.Index(base, "://"); idx != -1 {
		proto = base[:idx+3]
		host = base[idx+3:]
	}
	return fmt.Sprintf("%s%s.%s/%s", proto, s.bucket, host, key)
}

func (s *S3Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}
