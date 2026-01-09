const shell = require('shelljs')
var {storagePath} = require('../config/path')
var os = require('os');

// 封装判断Windows环境的函数
function isWindowsEnvironment() {
    // 核心判断逻辑：返回值为win32则是Windows
    return os.platform() === 'win32';
}
async function clone(url, name) {
    return new Promise(async (resolve, reject) => {
        console.log(storagePath)
        shell.cd(storagePath)
        let shellContent = 'GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no" git clone ' + url + (name?' ' + name : '')
        // 判断是否为windows环境
        if (isWindowsEnvironment()) {
            shellContent = 'git clone ' + url + (name?' ' + name : '')
        }
        const res = await shell.exec(shellContent)
        if (res.code !== 0) {
            reject(res)
            console.log(res)
            // process.exit() // 退出流程
        } else {
            resolve()
        }
    })

}
module.exports = clone;
