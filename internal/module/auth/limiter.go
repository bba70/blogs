package auth

import (
	"sync"
	"time"
)

const (
	// LimiterWindow 是登录失败计数的滑动窗口。
	LimiterWindow = 15 * time.Minute
	// LimiterMaxFailures 是窗口内允许的最大失败次数，超过后返回 429。
	LimiterMaxFailures = 5
)

// LoginLimiter 以可信客户端 IP 为键，在内存中维护短期登录失败次数。
// 计数不落数据库、不持久化，也不是业务数据；服务重启后清空，
// 且不跨多个 API 实例共享（扩展为多实例时需要外部共享存储）。
//
// 每次访问都会清理过期条目，防止攻击者制造无界内存增长。
type LoginLimiter struct {
	mu       sync.Mutex
	window   time.Duration
	maxFails int
	failures map[string][]time.Time
	now      func() time.Time
}

func NewLoginLimiter() *LoginLimiter {
	return &LoginLimiter{
		window:   LimiterWindow,
		maxFails: LimiterMaxFailures,
		failures: make(map[string][]time.Time),
		now:      time.Now,
	}
}

// Allow 判断给定 IP 当前是否还允许尝试登录。
// 窗口内失败次数达到上限后返回 false（应映射为 429）。
func (l *LoginLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.sweepLocked(l.now())
	return len(l.failures[ip]) < l.maxFails
}

// RecordFailure 记录一次登录失败。
func (l *LoginLimiter) RecordFailure(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.sweepLocked(now)
	l.failures[ip] = append(l.failures[ip], now)
}

// Reset 在成功登录后清除该 IP 的失败记录。
func (l *LoginLimiter) Reset(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.failures, ip)
}

// sweepLocked 清理窗口外的失败记录与空条目。调用方需持有锁。
func (l *LoginLimiter) sweepLocked(now time.Time) {
	cutoff := now.Add(-l.window)
	for ip, times := range l.failures {
		expired := 0
		for expired < len(times) && !times[expired].After(cutoff) {
			expired++
		}
		if expired == 0 {
			continue
		}
		if expired == len(times) {
			delete(l.failures, ip)
			continue
		}
		l.failures[ip] = append([]time.Time{}, times[expired:]...)
	}
}
