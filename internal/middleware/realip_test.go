package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func runRealIP(remoteAddr, xRealIP, xForwardedFor string) string {
	handler := RealIP()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(r.RemoteAddr))
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = remoteAddr
	if xRealIP != "" {
		req.Header.Set("X-Real-IP", xRealIP)
	}
	if xForwardedFor != "" {
		req.Header.Set("X-Forwarded-For", xForwardedFor)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec.Body.String()
}

func TestRealIPTrustsControlledProxy(t *testing.T) {
	// Docker 内部网络来源：信任代理写入的 X-Real-IP。
	if got := runRealIP("172.18.0.2:40000", "203.0.113.5", ""); got != "203.0.113.5" {
		t.Errorf("RemoteAddr = %q, want 203.0.113.5", got)
	}
	// 本机 Vite 代理：环回来源同样可信。
	if got := runRealIP("127.0.0.1:40000", "203.0.113.6", ""); got != "203.0.113.6" {
		t.Errorf("RemoteAddr = %q, want 203.0.113.6", got)
	}
}

func TestRealIPIgnoresUntrustedPeer(t *testing.T) {
	// 公网直连时不得采用请求头中的地址，防止伪造 IP 绕过限流。
	if got := runRealIP("203.0.113.99:40000", "10.1.1.1", "10.2.2.2"); got != "203.0.113.99:40000" {
		t.Errorf("RemoteAddr = %q, want unchanged 203.0.113.99:40000", got)
	}
}

func TestRealIPFallsBackToForwardedForRightmost(t *testing.T) {
	// 无 X-Real-IP 时取 X-Forwarded-For 最右侧合法 IP（最靠近受控代理写入端）。
	got := runRealIP("172.18.0.2:40000", "", "1.2.3.4, 203.0.113.7")
	if got != "203.0.113.7" {
		t.Errorf("RemoteAddr = %q, want 203.0.113.7", got)
	}
}

func TestRealIPKeepsRemoteAddrWithoutHeaders(t *testing.T) {
	if got := runRealIP("172.18.0.2:40000", "", ""); got != "172.18.0.2:40000" {
		t.Errorf("RemoteAddr = %q, want unchanged", got)
	}
}
