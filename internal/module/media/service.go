package media

import (
	"bytes"
	"context"
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
)

const MaxImageSize = 5 << 20

var (
	ErrUnauthorized = errors.New("authentication required")
	ErrTooLarge     = errors.New("image exceeds 5 MB")
	ErrInvalidImage = errors.New("only valid JPEG, PNG and GIF images are supported")
)

// Storage isolates local persistence from validation and can be replaced by
// an object storage adapter without changing the upload API or article model.
type Storage interface {
	Save(context.Context, []byte, string) (string, error)
}

type Service struct{ storage Storage }

func NewService(storage Storage) *Service { return &Service{storage: storage} }

func (s *Service) Upload(ctx context.Context, owner bool, data []byte) (string, error) {
	if !owner {
		return "", ErrUnauthorized
	}
	if len(data) > MaxImageSize {
		return "", ErrTooLarge
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > 20_000_000 {
		return "", ErrInvalidImage
	}
	extensions := map[string]string{"jpeg": ".jpg", "png": ".png", "gif": ".gif"}
	extension, ok := extensions[format]
	if !ok {
		return "", ErrInvalidImage
	}
	if _, _, err := image.Decode(bytes.NewReader(data)); err != nil {
		return "", ErrInvalidImage
	}
	return s.storage.Save(ctx, data, extension)
}
