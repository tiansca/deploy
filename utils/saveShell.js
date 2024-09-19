const fs = require('fs')
const path = require('path')
const options = {
    encoding: 'utf8',
    mode: 0o777, // 设定权限为read and write for owner, group and others
    flag: 'w' // 写入模式
};
async function saveShell(path, content) {
    // 将content写入到path文件中
    await fs.promises.writeFile(path, content, options)
}
module.exports = saveShell