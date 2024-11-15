# 使用Node.js官方镜像作为基础镜像
FROM node:22.1.0

# 安装git
RUN apt-get update && apt-get install -y git


# 设置工作目录
WORKDIR /app

# 将应用的依赖文件复制到工作目录
COPY package*.json ./

#设置registry为淘宝镜像
RUN npm set registry https://registry.npmmirror.com

# 安装应用的所有依赖
RUN npm install

# 复制应用源代码到工作目录
COPY . .

# 暴露应用的端口
EXPOSE 3210

# 运行应用
CMD ["npm", "start"]