const shell = require('shelljs')
var path = require('../config/path')
async function clone(url) {
    return new Promise(async (resolve, reject) => {
        console.log(path)
        shell.cd(path)
        const res = await shell.exec('git clone ' + url)
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
