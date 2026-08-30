package config

import (
	"bufio"
	"os"
	"strings"
)

// loadDotEnv 读取 KEY=VALUE 格式的 .env 文件，仅补充尚未设置的环境变量，
// 不覆盖进程已有环境。文件不存在或不可读时静默忽略。
// 这样本地直接运行 Go 服务与 Docker Compose 可以共用同一份 .env。
func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		value = strings.TrimSpace(value)
		// 去掉成对的包裹引号，允许值中包含空格。
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') ||
				(value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
	// .env 只是补充配置，读取错误不阻塞启动。
	_ = scanner.Err()
}
