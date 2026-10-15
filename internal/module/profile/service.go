package profile

import (
	"context"
	"errors"
	"log/slog"
	"strings"
)

// ErrUnauthorized 表示当前身份无权修改作者资料，由 handler 映射为 401。
var ErrUnauthorized = errors.New("authentication required")

// Store 定义 service 依赖的数据库访问面，便于测试注入替身。
// Repository 是该接口的生产实现。
type Store interface {
	Get(ctx context.Context) (*Profile, error)
	UpdateAvatarURL(ctx context.Context, avatarURL string) (*Profile, error)
}

// AvatarFiles 定义头像文件本身的归属校验与清理，生产实现为 media.LocalStorage。
type AvatarFiles interface {
	ValidURL(value string) bool
	DeleteURL(ctx context.Context, value string) error
}

type Service struct {
	store Store
	files AvatarFiles
}

func NewService(store Store, files AvatarFiles) *Service {
	return &Service{store: store, files: files}
}

// Get 返回站点作者资料；未设置头像时 AvatarURL 为空字符串。
// 头像是公开展示内容，访客也可读取。
func (s *Service) Get(ctx context.Context) (*Profile, error) {
	return s.store.Get(ctx)
}

// UpdateAvatar 更新头像，仅作者可调用（路由层已强制作者身份，此处兜底）。
//
// 只接受媒体库地址或空值：允许外部地址会让头像展示依赖第三方站点，
// 也会绕过上传接口的图片类型与体积校验。
func (s *Service) UpdateAvatar(ctx context.Context, owner bool, avatarURL string) (*Profile, error) {
	if !owner {
		return nil, ErrUnauthorized
	}
	avatarURL = strings.TrimSpace(avatarURL)
	if avatarURL != "" && !s.files.ValidURL(avatarURL) {
		return nil, &ValidationError{Message: "头像必须是已上传的图片，请先上传图片"}
	}

	current, err := s.store.Get(ctx)
	if err != nil {
		return nil, err
	}
	updated, err := s.store.UpdateAvatarURL(ctx, avatarURL)
	if err != nil {
		return nil, err
	}

	// 旧头像已不再被引用，尽力清理。清理失败不影响本次更新结果，
	// 只会在上传目录留下一个不会再被访问的孤儿文件。
	if current != nil && current.AvatarURL != "" && current.AvatarURL != avatarURL {
		if err := s.files.DeleteURL(ctx, current.AvatarURL); err != nil {
			slog.Error("remove replaced avatar file", "error", err)
		}
	}
	return updated, nil
}
