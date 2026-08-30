package middleware

import (
	"net"
	"net/http"
	"strings"
)

// defaultTrustedProxyCIDRs 是默认信任的反向代理网段：环回与私有地址，
// 覆盖本机开发（Vite 代理）与 Docker 内部网络（Nginx 容器）。
// 若部署中受控代理位于这些网段之外，需要扩展该列表。
var defaultTrustedProxyCIDRs = []string{
	"127.0.0.0/8",
	"::1/128",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"fc00::/7",
}

type realIP struct {
	trusted []*net.IPNet
}

// RealIP 仅当请求的直接 TCP 来源属于可信代理网段时，才采用
// X-Real-IP / X-Forwarded-For 中的客户端地址替换 r.RemoteAddr；
// 其他情况保留 TCP 对端地址，防止公网客户端伪造 IP 绕过按 IP 的限流。
//
// 部署约束：不得让公网绕过受控反向代理直接访问 API 端口。
func RealIP() func(http.Handler) http.Handler {
	m := &realIP{}
	for _, cidr := range defaultTrustedProxyCIDRs {
		if _, ipNet, err := net.ParseCIDR(cidr); err == nil {
			m.trusted = append(m.trusted, ipNet)
		}
	}
	return m.wrap
}

func (m *realIP) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ip := m.clientIP(r); ip != "" {
			r.RemoteAddr = ip
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP 从受控代理头中提取客户端 IP；直接来源不可信时返回空串。
func (m *realIP) clientIP(r *http.Request) string {
	if !m.isTrusted(hostOf(r.RemoteAddr)) {
		return ""
	}

	// X-Real-IP 由入口代理写入其直接对端地址，优先采用。
	if raw := strings.TrimSpace(r.Header.Get("X-Real-IP")); raw != "" {
		if ip := net.ParseIP(raw); ip != nil {
			return ip.String()
		}
	}

	// X-Forwarded-For 可能被上游客户端追加伪造，取最右侧合法 IP
	//（最靠近受控代理写入端），而不是最左侧。
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		for i := len(parts) - 1; i >= 0; i-- {
			if ip := net.ParseIP(strings.TrimSpace(parts[i])); ip != nil {
				return ip.String()
			}
		}
	}
	return ""
}

func (m *realIP) isTrusted(host string) bool {
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	for _, ipNet := range m.trusted {
		if ipNet.Contains(ip) {
			return true
		}
	}
	return false
}

func hostOf(remoteAddr string) string {
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		return host
	}
	return remoteAddr
}
