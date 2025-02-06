var storagePath = 'D:\\data\\deploy\\projects' // git项目拉取到这里
var deployRootPath = 'D:\\data\\nginx\\html' // nginx页面目录
var shellPath = 'D:\\data\\deploy\\shell' // shell目录
var zipPath = 'D:\\data\\deploy\\zip' // zip目录
if (process.env.DOCKER === 'yes') {
  storagePath = '/home/deploy/projects/' // git项目拉取到这里
  deployRootPath = '/usr/share/nginx/html/' // nginx页面目录
  shellPath = '/home/deploy/shell/' // 脚本存放目录
  zipPath = '/home/deploy/zip/'
}
module.exports = {storagePath, deployRootPath, shellPath, zipPath}
