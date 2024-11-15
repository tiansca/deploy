const path = require("path");
const {NodeSSH} = require('node-ssh')
const shell = require("shelljs"); // ssh连接服务器
const SSH = new NodeSSH()

const connectSSH = async() => {
  try {
    // 密码连接
    await SSH.connect({
      host: '8.141.90.170',
      username: 'root',
      // privateKey: config.PRIVATE_KEY, //秘钥登录(推荐) 方式一
      password: 'tianSHI0402' // 密码登录 方式二
    })
  } catch (error) {
    console.log('连接失败')
    // process.exit() // 退出流程
  }
}

const runCommand = async(command, path) => {
  // eslint-disable-next-line no-unused-vars
  const result = await SSH.exec(command, [], { cwd: path })
  return result
  // defaultLog(result);
}

async function run() {
  await connectSSH()
  const shellPath = '/www/wwwroot/wxqr/run.sh'
  const localPath = path.resolve('D:\\data\\deploy\\shell\\b3a7ebc6-6d5f-4767-ae53-f53ee5b2884d.cmd')
  console.log('shellPath', shellPath)
  console.log('localPath', localPath)
  await SSH.putFiles([{local: localPath, remote: shellPath}])
  console.log('上传脚本成功')

  // 设置脚本文件执行权限
  await SSH.exec('chmod', ['777', shellPath])

  // 执行脚本文件
  const res = await runCommand('./run.sh', '/www/wwwroot/wxqr')

  // 断开连接
  await SSH.dispose()
  return '执行远程脚本成功<br>' + res
}

run()