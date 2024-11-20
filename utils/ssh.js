const {NodeSSH} = require('node-ssh') // ssh连接服务器
if (!global.SSH) {
  global.SSH = new NodeSSH()
}
const SSH = global.SSH

module.exports = SSH