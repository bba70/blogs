package response

import (
	"encoding/json"
	"net/http"
)

// 业务错误码。0 表示成功。
const (
	CodeInternal     = 1
	CodeNotFound     = 2
	CodeValidation   = 3
	CodeConflict     = 4
	CodeUnauthorized = 5
	CodeForbidden    = 6
	CodeRateLimited  = 7
)

type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

type Meta struct {
	Page    int   `json:"page"`
	PerPage int   `json:"per_page"`
	Total   int64 `json:"total"`
}

func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(APIResponse{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func JSONWithMeta(w http.ResponseWriter, status int, data interface{}, meta Meta) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(APIResponse{
		Code:    0,
		Message: "success",
		Data:    data,
		Meta:    &meta,
	})
}

func Error(w http.ResponseWriter, status int, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(APIResponse{
		Code:    code,
		Message: message,
	})
}
