#!/usr/bin/env python3
"""
功能说明：
执行基于环境变量凭据的远程 SSH 命令。

业务背景：
本地和后续项目需要复用同一台服务器的 SSH 凭据，避免在命令里重复输入或暴露密码。

核心逻辑：
按 host/user 规范化生成环境变量键，优先读取 CODEX_SSH_USER__<HOST> 与
CODEX_SSH_PASSWORD__<HOST>__<USER>，再使用 Paramiko 建立连接并执行命令。

关键约束：
脚本只从本机环境变量读取密码，不接受明文密码参数；执行前提是本机已安装 Paramiko。
"""

from __future__ import annotations

import argparse
import os
import re
import sys

try:
    import paramiko
except ImportError as error:  # pragma: no cover
    raise SystemExit(
        "缺少 paramiko 依赖，请先执行 `python -m pip install --user paramiko`。"
    ) from error


def normalize_env_segment(value: str) -> str:
    normalized = re.sub(r"[^0-9A-Za-z]+", "_", value).strip("_").upper()
    if not normalized:
        raise ValueError("无法从空白 host 或 user 生成环境变量名称。")
    return normalized


def read_persisted_user_env(key: str) -> str | None:
    if os.name != "nt":
        return None

    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment") as environment_key:
            value, _ = winreg.QueryValueEx(environment_key, key)
    except OSError:
        return None

    return value if isinstance(value, str) and value else None


def get_env_value(key: str) -> str | None:
    return os.environ.get(key) or read_persisted_user_env(key)


def resolve_user(host: str, provided_user: str | None) -> str:
    if provided_user:
        return provided_user

    host_segment = normalize_env_segment(host)
    env_key = f"CODEX_SSH_USER__{host_segment}"
    user = get_env_value(env_key)
    if user:
        return user

    raise SystemExit(
        f"未提供 SSH 用户，且环境变量 `{env_key}` 不存在。"
    )


def resolve_password(host: str, user: str) -> tuple[str, str]:
    host_segment = normalize_env_segment(host)
    user_segment = normalize_env_segment(user)
    candidate_keys = [
        f"CODEX_SSH_PASSWORD__{host_segment}__{user_segment}",
        f"CODEX_SSH_PASSWORD__{host_segment}",
    ]

    for key in candidate_keys:
        value = get_env_value(key)
        if value:
            return value, key

    formatted = "、".join(f"`{key}`" for key in candidate_keys)
    raise SystemExit(f"未找到 SSH 密码环境变量，请设置 {formatted}。")


def resolve_command(provided_command: str | None) -> str:
    if provided_command:
        return provided_command

    if not sys.stdin.isatty():
        command = sys.stdin.read().strip()
        if command:
            return command

    raise SystemExit("缺少远程命令，请通过 `--cmd` 传入，或从标准输入提供命令内容。")


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="使用本机环境变量中的凭据执行远程 SSH 命令。"
    )
    parser.add_argument("--host", required=True, help="远程主机地址，例如 112.126.57.154")
    parser.add_argument("--user", help="远程用户名；未传时尝试从环境变量读取")
    parser.add_argument("--port", type=int, default=22, help="SSH 端口，默认 22")
    parser.add_argument("--cmd", help="要执行的远程命令；未传时尝试从标准输入读取")
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="连接和执行超时时间，单位秒，默认 30",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="不输出连接信息，只输出远程命令结果",
    )
    return parser


def main() -> int:
    parser = create_parser()
    argv = sys.argv[1:]
    if argv[:1] == ["--"]:
        argv = argv[1:]
    args = parser.parse_args(argv)

    user = resolve_user(args.host, args.user)
    password, password_env_key = resolve_password(args.host, user)
    command = resolve_command(args.cmd)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=args.host,
            port=args.port,
            username=user,
            password=password,
            timeout=args.timeout,
            look_for_keys=False,
            allow_agent=False,
        )

        if not args.quiet:
            print(
                f"已连接 {user}@{args.host}:{args.port}，凭据来源环境变量 `{password_env_key}`。",
                file=sys.stderr,
            )

        stdin, stdout, stderr = client.exec_command(command, timeout=args.timeout)
        exit_status = stdout.channel.recv_exit_status()
        sys.stdout.write(stdout.read().decode("utf-8", "ignore"))
        sys.stderr.write(stderr.read().decode("utf-8", "ignore"))
        return exit_status
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
