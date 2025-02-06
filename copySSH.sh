#!/bin/sh
#复制 /home/.ssh到/root/.ssh
if [ -d "/home/.ssh" ]; then
  cp -r -f /home/.ssh /root/
  #将/root/.ssh下的文件权限改为0700
  chmod 700 /root/.ssh/*
fi