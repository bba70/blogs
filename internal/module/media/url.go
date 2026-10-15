package media

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// URLPrefix 是媒体文件对外提供的访问地址前缀，与 Save 返回的地址一致。
const URLPrefix = "/api/v1/media/"

// ErrNotStoreURL 表示给定地址不指向本媒体库中的文件。
// 清理文件时拒绝这类地址，避免删除媒体库目录之外的内容。
var ErrNotStoreURL = errors.New("not a media store URL")

// ValidURL 判断 value 是否为本媒体库文件的访问地址。
// 该方法是 profile.AvatarFiles 的实现，用于拒绝指向外部站点的头像地址。
func (s *LocalStorage) ValidURL(value string) bool {
	_, ok := mediaFileName(value)
	return ok
}

// DeleteURL 删除媒体地址指向的文件。文件已经不存在时视为删除成功，
// 让重复清理不产生错误。
func (s *LocalStorage) DeleteURL(ctx context.Context, value string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	name, ok := mediaFileName(value)
	if !ok {
		return ErrNotStoreURL
	}
	if err := os.Remove(filepath.Join(s.directory, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// mediaFileName 从媒体地址解析文件名。只接受 /api/v1/media/<32 位十六进制>.<jpg|png|gif>
// 这一种形式，调用方无法借此访问媒体库之外的路径。
func mediaFileName(value string) (string, bool) {
	name, found := strings.CutPrefix(value, URLPrefix)
	if !found || !imageName.MatchString(name) {
		return "", false
	}
	return name, true
}
