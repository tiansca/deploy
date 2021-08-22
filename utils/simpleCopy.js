const path = require('path')
const copyPromise = require('./copy')
const fs = require('fs')
const zipFile = require('compressing')
const myDelete = require('./delete')

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

// 压缩代码
const zipDist = async(from) => {
    const zipName = `cache${Math.round(Math.random() * 100)}.zip`
    const distDir = path.resolve(from) // 待打包目录
    const distZipPath = path.resolve(from, `../${zipName}`) // 压缩包目录
    console.log('压缩...')
    try {
        await zipFile.zip.compressDir(distDir, distZipPath)
        console.log('压缩成功')
        return Promise.resolve(zipName)
        // successLog('压缩成功!')
    } catch (error) {
        console.log('压缩错误', error)
        // errorLog(error)
        // errorLog('压缩失败, 退出程序!')
        //process.exit() // 退出流程
    }
}

// 解压
const unzip = async(source) => {
    return new Promise((resolve, reject) => {
        try {
            zipFile.zip.uncompress(source, path.resolve(source, '../')).then(res => {
                console.log('解压成功')
                resolve()
            }).catch(err => {
                console.log(err)
                reject()
            }) //如果要解压到当前目录换成 './'
        } catch (e) {
            reject()
        }
    })
}

// 删除
const remove = async(source) => {
    console.log('删除文件', source)
    await fs.chmodSync(source,'0777')
    await fs.unlinkSync(source)
}

function simpleCopy(from, to) {
    return new Promise(async (resolve, reject) => {
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
                    // fs.createReadStream(from).pipe(fs.createWriteStream(to))
                    await copyPromise(from, to)
                    resolve()
                } catch (e) {
                    console.log(e)
                }

            } else {
                // 创建文件夹
                // 文件夹，打包，复制到目标文件夹下，然后解压，复制内容到目标文件夹
                const toExists = await getStat(to);
                if (!toExists) {
                    console.log('创建文件夹', to)
                    fs.mkdirSync(to);
                }
                try {
                    // 压缩文件
                    const zipName = await zipDist(from)
                    // 复制到目标路径下
                    await copyPromise(path.resolve(from, `../${zipName}`), path.resolve(to, `./${zipName}`))
                    // 删除文件压缩包
                    await remove(path.resolve(from, `../${zipName}`))
                    // 解压目标路径下的文件夹
                    console.log('解压文件', path.resolve(to, `./${zipName}`))
                    await unzip(path.resolve(to, `./${zipName}`))
                    // 复制解压文件夹下的文件到目标路径
                    let pathIndex = from.split(path.sep).join('/').lastIndexOf("\/");  //兼容两个平台 并获取最后位置index
                    const dirName = from.substring(pathIndex + 1, from.length); //截取获得结果
                    console.log('***************', dirName)
                    await copyPromise(path.resolve(to, `./${dirName}`), path.resolve(to))
                    // 删除压缩包、删除文件夹
                    await remove(path.resolve(to, `./${zipName}`))
                    await myDelete(path.resolve(to, `./${dirName}`))
                    resolve()
                } catch (e) {
                    console.log(e)
                }

            }
        })
    })
}

// 复制文件或者目录下的文件到目标路径
// simpleCopy('test/123', test/abc) // 复制123下的文件到abc下
module.exports = simpleCopy
// unzip('D:\\tiansc\\package\\deploy-online\\cache17.zip')
