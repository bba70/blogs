package media

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

var imageName = regexp.MustCompile(`^[a-f0-9]{32}\.(jpg|png|gif)$`)

type ImageFile struct {
	Content  io.ReadSeekCloser
	Modified time.Time
	Name     string
}
type Reader interface {
	Open(string) (*ImageFile, error)
}
type LocalStorage struct{ directory string }

func NewLocalStorage(directory string) (*LocalStorage, error) {
	path, err := filepath.Abs(directory)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(path, 0755); err != nil {
		return nil, err
	}
	return &LocalStorage{directory: path}, nil
}

func (s *LocalStorage) Save(ctx context.Context, data []byte, extension string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return "", err
	}
	name := hex.EncodeToString(id[:]) + extension
	if !imageName.MatchString(name) {
		return "", ErrInvalidImage
	}
	path := filepath.Join(s.directory, name)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return "", err
	}
	_, writeErr := f.Write(data)
	closeErr := f.Close()
	if writeErr != nil || closeErr != nil {
		_ = os.Remove(path)
		if writeErr != nil {
			return "", writeErr
		}
		return "", closeErr
	}
	return "/api/v1/media/" + name, nil
}

func (s *LocalStorage) Open(name string) (*ImageFile, error) {
	if !imageName.MatchString(name) {
		return nil, os.ErrNotExist
	}
	path := filepath.Join(s.directory, name)
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, os.ErrNotExist
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	return &ImageFile{Content: f, Modified: info.ModTime(), Name: name}, nil
}
