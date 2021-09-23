const shell = require('shelljs')
const path = require('path')
var { storagePath } = require('../config/path')
async function clone(url, name) {
    return new Promise(async (resolve, reject) => {
        console.log(storagePath)
        shell.cd(storagePath)
        const res = await shell.exec('git clone ' + url + (name?' ' + name : ''), {cwd: path.resolve(storagePath)})
        if (res.code !== 0) {
            reject()
            console.log(res)
            // process.exit() // 退出流程
        } else {
            resolve()
        }
    })

}
module.exports = clone;
