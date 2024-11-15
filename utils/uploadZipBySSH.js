const path = require('path')
const {zipPath} = require('../config/path')
const node_ssh = require('node-ssh') // ssh连接服务器
const SSH = new node_ssh()

const connectSSH = async(project) => {
  try {
    if (project.connectionType) {
      // 密钥连接
      console.log(path.resolve(project.privateKey))
      await SSH.connect({
        host: project.ip,
        username: project.username,
        privateKey: path.resolve(project.privateKey), //秘钥登录(推荐) 方式一
        // password: project.password // 密码登录 方式二
      })
    } else {
      // 密码连接
      await SSH.connect({
        host: project.ip,
        username: project.username,
        // privateKey: config.PRIVATE_KEY, //秘钥登录(推荐) 方式一
        password: project.password // 密码登录 方式二
      })
    }
  } catch (error) {
    console.log('连接失败')
    // process.exit() // 退出流程
  }
}

// 线上执行命令
/**
 *
 * @param {String} command 命令操作 如 ls
 */
const runCommand = async(command, s_path) => {
  // eslint-disable-next-line no-unused-vars
  console.log('执行命令', command, s_path)
  const result = await SSH.exec(command, [], { cwd: s_path })
  return result
  // defaultLog(result);
}

const clearOldFile = async(path) => {
  if (!path || path === '/' || path === './' || path.length < 10) {
    return Promise.reject('error：路径不完整')
  }
  const commands = ['ls', 'rm -rf *']
  await Promise.all(commands.map(async(it) => {
    return await runCommand(it, path)
  }))
}

const uploadZipBySSH = async(project) => {
  if (!project.path || project.path === '/') {
    console.log('路径不完整', project.path)
    return false
  }
  let onlinePath = project.path
  onlinePath = onlinePath.replace('///', '/')
  onlinePath = onlinePath.replace('//', '/')
  console.log('onlinePath', onlinePath, project)
  // 连接ssh
  await connectSSH(project)
  // 创建目录
  await runCommand(`mkdir -p ${onlinePath}`)
  try {
    // 判断远程是否支持 unzip命令
    const isUnzip = await runCommand(`command -v unzip`)
    if (!isUnzip) {
      if (await runCommand(`command -v yum`)) {
        await runCommand(`yum install unzip -y`)
      } else if (await runCommand(`command -v apt-get`)) {
        await runCommand(`apt-get install unzip -y`)
      }
    }
    // 线上目标文件清空
    console.log('正在清空...')
    await clearOldFile(onlinePath)
    console.log('正在上传...')
    const distZipPath = path.resolve(zipPath, './' + (project.localPath || project.name), './dist.zip')
    console.log('distZipPath', distZipPath)
    await SSH.putFiles([{ local: distZipPath, remote: onlinePath + '/dist.zip' }]) // local 本地 ; remote 服务器 ;
    console.log('正在解压...')
    await runCommand('unzip ./dist.zip', onlinePath) // 解压
    await runCommand(`rm -rf ${onlinePath}/dist.zip`, onlinePath) // 解压完删除线上压缩包
    // 将目标目录的dist里面文件移出到目标文件
    // 举个例子 假如我们部署在 /test/html 这个目录下 只有一个网站, 那么上传解压后的文件在 /test/html/dist 里
    // 需要将 dist 目录下的文件 移出到 /test/html ;  多网站情况, 如 /test/html/h5  或者 /test/html/admin 都和上面同样道理
    await runCommand(`mv -f ${onlinePath}/dist/*  ${onlinePath}`, onlinePath)
    await runCommand(`rm -rf ${onlinePath}/dist`, onlinePath) // 移出后删除 dist 文件夹
    SSH.dispose() // 断开连接
    const id = project._id.toString()
    console.log(id)
    return Promise.resolve('上传成功')
  } catch (error) {
    console.log(error)
    return Promise.reject(error)
    //process.exit() // 退出流程
  }
}

module.exports = uploadZipBySSH