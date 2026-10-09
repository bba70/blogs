// hashpass 生成作者密码的 bcrypt 哈希，用于配置 AUTH_PASSWORD_HASH。
//
// 用法：
//
//	go run ./cmd/hashpass            # 从标准输入读取密码（推荐，避免进入 shell 历史）
//	go run ./cmd/hashpass <password> # 通过参数传入（会留在 shell 历史中）
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	password, err := readPassword()
	if err != nil {
		fmt.Fprintln(os.Stderr, "读取密码失败:", err)
		os.Exit(1)
	}
	if password == "" {
		fmt.Fprintln(os.Stderr, "密码不能为空")
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "生成哈希失败:", err)
		os.Exit(1)
	}

	fmt.Println(string(hash))
}

func readPassword() (string, error) {
	if len(os.Args) > 1 {
		fmt.Fprintln(os.Stderr, "提示：命令行参数会留在 shell 历史，建议改用标准输入：go run ./cmd/hashpass")
		return strings.Join(os.Args[1:], " "), nil
	}

	fmt.Fprint(os.Stderr, "请输入作者密码：")
	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil && line == "" {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}
