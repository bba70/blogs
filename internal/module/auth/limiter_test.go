package auth

import (
	"testing"
	"time"
)

// testClock 是可变测试时钟，通过指针共享，便于在测试中推进时间。
type testClock struct {
	now time.Time
}

func newClockLimiter(t *testing.T, now time.Time) (*LoginLimiter, *testClock) {
	t.Helper()
	clock := &testClock{now: now}
	l := NewLoginLimiter()
	l.now = clock.Now
	return l, clock
}

func (c *testClock) Now() time.Time { return c.now }

func TestLimiterAllowsUpToLimitThenBlocks(t *testing.T) {
	l, _ := newClockLimiter(t, time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))

	const ip = "203.0.113.7"

	for i := 1; i <= LimiterMaxFailures; i++ {
		if !l.Allow(ip) {
			t.Fatalf("attempt %d should be allowed before reaching the limit", i)
		}
		l.RecordFailure(ip)
	}
	if l.Allow(ip) {
		t.Error("the 6th attempt within the window must be blocked")
	}
}

func TestLimiterWindowExpiry(t *testing.T) {
	l, clock := newClockLimiter(t, time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))

	const ip = "203.0.113.7"
	for range LimiterMaxFailures {
		l.RecordFailure(ip)
	}
	if l.Allow(ip) {
		t.Fatal("blocked before window expiry")
	}

	clock.now = clock.now.Add(LimiterWindow + time.Second)
	if !l.Allow(ip) {
		t.Error("must be allowed again after the window expires")
	}
}

func TestLimiterResetOnSuccess(t *testing.T) {
	l, _ := newClockLimiter(t, time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))

	const ip = "203.0.113.7"
	l.RecordFailure(ip)
	l.RecordFailure(ip)
	l.Reset(ip)

	for i := range LimiterMaxFailures {
		if !l.Allow(ip) {
			t.Fatalf("after reset, failure %d must still be allowed", i+1)
		}
		l.RecordFailure(ip)
	}
	if l.Allow(ip) {
		t.Error("blocked only after the fresh failures reach the limit")
	}
}

func TestLimiterIsPerIP(t *testing.T) {
	l, _ := newClockLimiter(t, time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))

	blocked, other := "203.0.113.7", "203.0.113.8"
	for range LimiterMaxFailures {
		l.RecordFailure(blocked)
	}
	if l.Allow(blocked) {
		t.Error("blocked ip must stay blocked")
	}
	if !l.Allow(other) {
		t.Error("another ip must not be affected")
	}
}

func TestLimiterSweepsExpiredEntries(t *testing.T) {
	l, clock := newClockLimiter(t, time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))

	l.RecordFailure("203.0.113.7")
	l.RecordFailure("203.0.113.8")

	clock.now = clock.now.Add(LimiterWindow + time.Minute)
	if !l.Allow("203.0.113.9") { // 触发一次清理
		t.Fatal("unrelated ip must be allowed")
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.failures) != 0 {
		t.Errorf("expired entries must be swept, got %d", len(l.failures))
	}
}
