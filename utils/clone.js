const shell = require('shelljs')
var {storagePath} = require('../config/path')
async function clone(url, name) {
    return new Promise(async (resolve, reject) => {
        console.log(storagePath)
        shell.cd(storagePath)
        const res = await shell.exec('git clone ' + url + (name?' ' + name : ''))
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
