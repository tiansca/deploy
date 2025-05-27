#!/bin/sh
# 复制/home/.ssh到/root/.ssh
if [ -d "/home/.ssh" ]; then
  cp -r -f /home/.ssh /root/
  chmod 700 /root/.ssh/*
fi
# 全局安装 pnpm
if command -v npm >/dev/null 2>&1; then
  echo "正在安装 pnpm..."
  npm install -g pnpm
else
  echo "错误：未找到 npm 命令，请确保 Node.js 已安装。" >&2
  exit 1
fi
# 全局安装 yarn
if command -v npm >/dev/null 2>&1; then
  echo "正在安装 yarn..."
  npm install -g yarn
else
  echo "错误：未找到 npm 命令，请确保 Node.js 已安装。" >&2
  exit 1
fi
