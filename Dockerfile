# 使用Node.js官方镜像作为基础镜像（基于Debian 12 Bookworm）
FROM node:22.22.2

# 设置环境变量
ENV DOCKER yes
ENV MOMGO_DOCKER yes
# 新增Java 8环境变量（关键：指定JAVA_HOME）
ENV JAVA_HOME /usr/lib/jvm/temurin-8-jdk-amd64
ENV PATH $PATH:$JAVA_HOME/bin

# 核心优化：Debian主源用清华镜像（提速），Adoptium用官方源（保证可用性）
RUN \
    # cp /etc/apt/sources.list /etc/apt/sources.list.bak && \
    # 替换为清华Debian 12 (Bookworm) 镜像源（国内访问速度快）
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-backports main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    # 更新源并安装基础依赖（添加超时/重试优化参数）
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 update && \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 install -y --no-install-recommends \
    # 基础依赖
    git \
    ca-certificates \
    curl \
    gnupg \
    # Python 3相关
    python3 \
    python3-pip \
    python3-dev \
    && rm -rf /var/lib/apt/lists/* \
    # 添加Adoptium官方GPG密钥（用于验证Java包）
    && mkdir -p /etc/apt/trusted.gpg.d \
    && curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /etc/apt/trusted.gpg.d/adoptium.gpg \
    # 恢复Adoptium官方源（清华源无bookworm版本，只能用官方）
    && echo "deb https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" > /etc/apt/sources.list.d/adoptium.list \
    # 重新更新源并安装Java 8（Temurin 8），增加重试次数
    && apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 update && \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 install -y --no-install-recommends \
    temurin-8-jdk \
    # 清理缓存，减小镜像体积
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 验证Java和Python安装（可选：用于调试，确认版本正确）
RUN java -version && javac -version && python3 --version && pip3 --version

# 创建zip目录
RUN mkdir -p /home/deploy/zip

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

# 删除node_modules文件夹，解决第二次使用ssh2异常退出的问题
RUN rm -rf /app/node_modules/ssh2/lib/protocol/crypto/build/Release/sshcrypto.node

# 暴露应用的端口
EXPOSE 3210

# 运行应用
CMD ["npm", "start"]