package profile

import "time"

// Profile 是站点作者资料。当前阶段只保存头像，
// 姓名、简介等字段等有明确需求时再通过迁移扩展。
type Profile struct {
	AvatarURL string    `json:"avatar_url"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpdateReq 是作者资料更新请求。avatar_url 为空表示清除头像；
// 非空时必须指向已上传到媒体库的图片。
type UpdateReq struct {
	AvatarURL string `json:"avatar_url"`
}

// ValidationError 表示请求参数不合法，由 handler 映射为 400。
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string { return e.Message }
