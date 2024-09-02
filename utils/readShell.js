const fs = require('fs')
const path = require('path')

async function readShell(path, content) {
    // 将content写入到path文件中
    const data = await fs.promises.readFile(path)
    return data.toString()
}
module.exports = readShell