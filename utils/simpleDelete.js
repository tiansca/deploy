const myDelete = require('./delete.js')
const fs = require('fs')
const path = require('path')
const simpleDelete = (source) => {
    return new Promise((resolve, reject) => {
        fs.readdir(source, function (err, dirs) {
            console.log('清空文件夹失败', err)
            if (err) reject(err)
            dirs = dirs.map(dir => path.join(source, dir)) // a/b a/c
            let index = 0;
            (async function next() {
                if (index === dirs.length) {
                    // 文件夹为空，或者删除成功
                    resolve()
                } else {
                    myDelete(dirs[index++]).then(() => {
                        next()
                    }, err => {
                        console.log('删除文件夹失败')
                        reject(err || '删除文件夹失败')
                    })
                }
            })()
        })
    })
}
module.exports = simpleDelete
