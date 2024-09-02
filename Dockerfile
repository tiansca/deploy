# 使用Node.js官方镜像作为基础镜像
FROM node:18.18.2

# 设置工作目录
WORKDIR /app

# 将应用的依赖文件复制到工作目录
COPY package*.json ./

# 安装应用的所有依赖
RUN npm install

# 复制应用源代码到工作目录
COPY . .

# 暴露应用的端口
EXPOSE 3210

# 安装Python和Java
RUN apt-get update && \
    apt-get install -y python3 openjdk-11-jdk && \
    rm -rf /var/lib/apt/lists/*

# 运行应用
CMD ["npm", "start"]