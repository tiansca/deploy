const fs = require('fs')
const path = require('path')
// let count = 0
//读取路径信息
function getStat(path){
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if(err){
                resolve(false);
                return false
            }else{
                resolve(stats);
                return true
            }
        })
    })
}

function copyPromise(from, to) {
    return new Promise(async (resolve, reject) => {
        if (!from || !to) {
            reject()
            return
        }
        console.log('开始', from, to)
        let isExists = await getStat(from);
        if (!isExists) {
            reject()
            return
        }
        fs.stat(from, async function (err, stat) {
            if (err) reject(err)
            if (stat.isFile()) {
                console.log('复制文件', to)
                try{
                    // await fs.createReadStream(from).pipe(fs.createWriteStream(to))
                    const readable = fs.createReadStream(from)
                    const writable = fs.createWriteStream(to)
                    writable.on('finish', () => {
                        resolve()
                        console.log('复制完成')
                    })
                    readable.pipe(writable)
                } catch (e) {
                    console.log(e)
                }

            } else {
                // 创建文件夹
                const toExists = await getStat(to);
                if (!toExists) {
                    console.log('创建文件夹', to)
                    fs.mkdirSync(to);
                }
                console.log('复制文件', to)
                fs.readdir(from, function (err, dirs) {
                    if (err) reject(err)
                    // dirs为from下的文件夹
                    const fromDirs = dirs.map(dir => path.join(from, dir)) // a/b a/c
                    const toDirs = dirs.map(dir => path.join(to, dir)) // a/b a/c
                    let index = 0;
                    (function next() {
                        console.log('dirs', fromDirs.length)
                        if (index === fromDirs.length) {
                            // from为空文件夹
                            console.log('return')
                            // resolve()
                        } else {
                            copyPromise(fromDirs[index], toDirs[index]).then(() => {
                                console.log('复制文件夹成功')
                                index++
                                if(index < fromDirs.length) {
                                    next()
                                } else {
                                    resolve()
                                }

                            }, err => {
                                console.log('创建文件夹失败')
                                reject(err)
                            })
                        }
                    })()
                })
            }
            // resolve()
        })
    })
}
// 复制文件或者文件夹到指定目录，两个参数，源文件和目标文件：
// copyPromise('D:\\tiansc\\package\\deploy-online\\123', 'D:\\tiansc\\package\\123')   复制文件夹
// copyPromise('D:\\tiansc\\package\\deploy-online\\123', 'D:\\tiansc\\package\\123')   复制文件
module.exports = copyPromise
