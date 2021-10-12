const shell = require('shelljs')
var { storagePath } = require('../config/path')
var { deployRootPath } = require('../config/path')
const zipFile = require('compressing')
const node_ssh = require('node-ssh') // ssh连接服务器
const SSH = new node_ssh()
const path = require('path')
const fs = require('fs')
let { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
let request = require("request");
const simpleCopy = require('./simpleCopy')
const simpleDelete = require('./simpleDelete')
// let mongoose=require('mongoose');
//等待两秒
// const wait2s = async () => {
//     await setTimeout(function () {
//         console.log('......')
//     }, 2000)
// }

// 压缩代码
const zipDist = async(project) => {
    const distDir = path.resolve(storagePath, './' + project.name, './dist') // 待打包
    const distZipPath = path.resolve(storagePath, './' + project.name, './dist.zip')
    console.log('压缩...')
    try {
        await zipFile.zip.compressDir(distDir, distZipPath)
        console.log('压缩成功')
        // successLog('压缩成功!')
    } catch (error) {
        console.log('压缩错误', error)
        // errorLog(error)
        // errorLog('压缩失败, 退出程序!')
        //process.exit() // 退出流程
    }
}

// 连接服务器
const connectSSH = async(project) => {
    try {
        await SSH.connect({
            host: project.ip,
            username: project.username,
            // privateKey: config.PRIVATE_KEY, //秘钥登录(推荐) 方式一
            password: project.password // 密码登录 方式二
        })
    } catch (error) {
        console.log('连接失败')
        // process.exit() // 退出流程
    }
}

// 线上执行命令
/**
 *
 * @param {String} command 命令操作 如 ls
 */
const runCommand = async(command, path) => {
    // eslint-disable-next-line no-unused-vars
    const result = await SSH.exec(command, [], { cwd: path })
    // defaultLog(result);
}

// 清空线上目标目录里的旧文件
const clearOldFile = async(project) => {
    const commands = ['ls', 'rm -rf *']
    await Promise.all(commands.map(async(it) => {
        return await runCommand(it, project.path)
    }))
}

// 传送zip文件到服务器
const uploadZipBySSH = async(project) => {
    const onlinePath = project.path
    // 连接ssh
    await connectSSH(project)
    // 线上目标文件清空
    console.log('正在清空...')
    await clearOldFile(project)
    console.log('正在上传...')
    const distZipPath = path.resolve(storagePath, './' + project.name, './dist.zip')
    try {
        await SSH.putFiles([{ local: distZipPath, remote: onlinePath + '/dist.zip' }]) // local 本地 ; remote 服务器 ;
        await runCommand('unzip ./dist.zip', onlinePath) // 解压
        await runCommand(`rm -rf ${onlinePath}/dist.zip`, onlinePath) // 解压完删除线上压缩包
        // 将目标目录的dist里面文件移出到目标文件
        // 举个例子 假如我们部署在 /test/html 这个目录下 只有一个网站, 那么上传解压后的文件在 /test/html/dist 里
        // 需要将 dist 目录下的文件 移出到 /test/html ;  多网站情况, 如 /test/html/h5  或者 /test/html/admin 都和上面同样道理
        await runCommand(`mv -f ${onlinePath}/dist/*  ${onlinePath}`, onlinePath)
        await runCommand(`rm -rf ${onlinePath}/dist`, onlinePath) // 移出后删除 dist 文件夹
        SSH.dispose() // 断开连接
        console.log('部署成功！')
        const id = project._id.toString()
        console.log(id)
        request('http://localhost:3210/add_record?id=' + id + '&name=' + project.name + '&branch=' + project.branch + '&ip=' + project.ip + '&path=' + project.path, function (error, response, body) {
            if (!error) {
                console.log(body);
            }
        });
    } catch (error) {
        console.log(error)
        //process.exit() // 退出流程
    }
}

//读取路径信息
function getStat(path){
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if(err){
                resolve(false);
            }else{
                resolve(stats);
            }
        })
    })
}

const isError = (str) => {
    if (str.indexOf('err') !== -1 || str.indexOf('ERR') !== -1) {
        return Promise.reject(str)
    } else {
        return Promise.resolve()
    }
}

async function deploy(project) {
    const directoryName = project.directoryName || project.name
    let isExists = await getStat(path.resolve(storagePath, directoryName));
    //如果该路径且不是文件，返回true
    if(!isExists || !isExists.isDirectory()){
        console.log('项目路径不存在！')
        return true;
    }
    let errorMsg = ''
    let finished = false
    try {
        console.log('路径=>', path.resolve(storagePath, directoryName))
        errorMsg += await shell.exec('git checkout .', {cwd: path.resolve(storagePath, directoryName)}).stderr + '<br>'
        console.log('error =>', errorMsg)
        await isError(errorMsg)
        errorMsg += 'git还原完成<br>'
        errorMsg += await shell.exec('git pull', {cwd: path.resolve(storagePath, directoryName)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'git拉取完成<br>'
        errorMsg += await shell.exec('git checkout ' + project.branch, {cwd: path.resolve(storagePath, directoryName)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'git切换分支完成<br>'
        // 打包
        errorMsg += await shell.exec('npm install --unsafe-perm', {cwd: path.resolve(storagePath, directoryName)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'npm install 完成<br>'
        errorMsg += await shell.exec(project.build ? project.build : 'npm run build:stage', {cwd: path.resolve(storagePath, directoryName)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += '打包完成<br>'
        console.log('error =>', errorMsg)
        // console.log('正在打包...')
        let deployPath = project.deployPath
        if (deployPath) {
            if (deployPath[0] === '/') {
                deployPath = deployPath.replace('/', '')
            }
            const fullDeployPath = path.resolve(deployRootPath,'./', deployPath)
            let isExists = await getStat(fullDeployPath);
            //如果该路径且不是文件，返回true
            console.log(deployRootPath, fullDeployPath)
            if(!isExists || !isExists.isDirectory()){
                console.log('项目路径不存在！')
                throw '部署路径不存在'
            } else {
                // 清空部署目录
                await simpleDelete(fullDeployPath)
                // 复制打包文件到部署目录
                let outputDir = project.outputDir || 'dist'
                if (outputDir[0] === '/') {
                    outputDir = outputDir.replace('/', '')
                }
                await simpleCopy(path.resolve(storagePath, directoryName, './', outputDir), path.resolve(fullDeployPath))
            }
        }
        errorMsg += '部署完成<br>'
        finished = true
    } catch (e) {
        errorMsg += e || '未知错误'
        console.log('错误', e)
    }
    // if (errorMsg) {
    //     errorMsg = encodeURI(errorMsg)
    // }
    // request('http://localhost:3210/add_record?id=' + project._id.toString() + '&name=' + project.name + '&branch=' + project.branch + "&log=" + errorMsg + '&success=' + finished, function (error, response, body) {
    //     if (!error) {
    //         console.log(body);
    //     } else {
    //         console.log(error)
    //     }
    // });
    request({
        url: 'http://localhost:3210/add_record',
        method: "POST",
        json: true,
        headers: {
            "content-type": "application/json",
        },
        body: {
            id: project._id.toString(),
            name: project.name,
            branch: project.branch,
            log: errorMsg,
            success: finished
        }
    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body) // 请求成功的处理逻辑
        }
    });

}

const runDeploy = (data) => {
    if (isMainThread) {
        // console.log('打印1=>', data._doc)
        const worker = new Worker(__filename, {
            // workerData: JSON.parse(JSON.stringify(data._doc))
            workerData: data
        });
        worker.on('message', (d) => {
            console.log('parent receive message:', d);
        });
        worker.on('error', (e) => {
            console.error('parent receive error', e);
        });
        worker.on('exit', (code) => {
            if (code !== 0)
                console.error(new Error(`工作线程使用退出码 ${code} 停止`));
        });
    }
    // } else {
    //     console.log(workerData)
    //     deploy(workerData)
    // }
}

if (!isMainThread) {
    deploy(workerData)
}

module.exports = runDeploy;


