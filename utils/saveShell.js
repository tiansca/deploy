const fs = require('fs')
const path = require('path')
const detectDangerousDeletes = require("./detectDangerousDeletes");
const options = {
    encoding: 'utf8',
    mode: 0o777, // 设定权限为read and write for owner, group and others
    flag: 'w' // 写入模式
};
async function saveShell(path, content) {
    // 将content写入到path文件中
    // 检查内容是否有删除
    if (detectDangerousDeletes(content)) {
        return Promise.reject('包含不安全命令，终止')
    }
    await fs.promises.writeFile(path, content, options)
}
module.exports = saveShell