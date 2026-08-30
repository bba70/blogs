package auth

import "net/http"

// CookieName 是作者会话 Cookie 的名称。Token 只存在于该 Cookie 中，
// 不进入 JSON 响应体，也不应写入 localStorage / sessionStorage。
const CookieName = "blog_owner_session"

// SetSessionCookie 写入作者会话 Cookie。
// 属性：HttpOnly、SameSite=Strict、Path=/、固定 7 天有效期；
// Secure 由配置决定（生产必须开启）。
func SetSessionCookie(w http.ResponseWriter, token string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(SessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
}

// ClearSessionCookie 写入同名、同 Path 的过期 Cookie，用于退出登录。
func ClearSessionCookie(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
}
