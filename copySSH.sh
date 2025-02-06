#!/bin/sh
# 复制/home/.ssh到/root/.ssh
if [ -d "/home/.ssh" ]; then
  cp -r -f /home/.ssh /root/
  chmod 700 /root/.ssh/*
fi
