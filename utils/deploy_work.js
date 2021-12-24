const shell = require('shelljs')
var deployPath = require('../config/path')
const zipFile = require('compressing')
const node_ssh = require('node-ssh') // ssh连接服务器
const SSH = new node_ssh()
const path = require('path')
const fs = require('fs')
let { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
let request = require("request");
const myDelete = require('./delete')
// let mongoose=require('mongoose');


//等待两秒
// const wait2s = async () => {
//     await setTimeout(function () {
//         console.log('......')
//     }, 2000)
// }

// 压缩代码
const zipDist = async(project) => {
    let outputDir = project.outputDir || 'dist'
    if (outputDir[0] === '/') {
        outputDir = outputDir.replace('/', '')
    }
    const distDir = path.resolve(deployPath, './' + (project.localPath || project.name), './', outputDir) // 待打包
    const distZipPath = path.resolve(deployPath, './' + (project.localPath || project.name), './dist.zip')
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
        if (project.connectionType) {
            // 密钥连接
            console.log(path.resolve(project.privateKey))
            await SSH.connect({
                host: project.ip,
                username: project.username,
                privateKey: path.resolve(project.privateKey), //秘钥登录(推荐) 方式一
                // password: project.password // 密码登录 方式二
            })
        } else {
            // 密码连接
            await SSH.connect({
                host: project.ip,
                username: project.username,
                // privateKey: config.PRIVATE_KEY, //秘钥登录(推荐) 方式一
                password: project.password // 密码登录 方式二
            })
        }
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
const clearOldFile = async(path) => {
    const commands = ['ls', 'rm -rf *']
    await Promise.all(commands.map(async(it) => {
        return await runCommand(it, path)
    }))
}

// 传送zip文件到服务器
const uploadZipBySSH = async(project) => {
    if (!project.path || project.path === '/' || !project.rootPath || project.rootPath === '/') {
        console.log('路径不完整', project.path, project.rootPath)
        return false
    }
    let onlinePath = project.rootPath + '/' + project.path
    onlinePath = onlinePath.replace('///', '/')
    onlinePath = onlinePath.replace('//', '/')
    console.log('onlinePath', onlinePath)
    // 连接ssh
    await connectSSH(project)
    // 线上目标文件清空
    console.log('正在清空...')
    await clearOldFile(onlinePath)
    console.log('正在上传...')
    const distZipPath = path.resolve(deployPath, './' + (project.localPath || project.name), './dist.zip')
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
        return Promise.resolve('部署成功')
    } catch (error) {
        console.log(error)
        return Promise.reject(error)
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
    // console.log('msg', str)
    if (str.indexOf('err') !== -1 || str.indexOf('ERR') !== -1) {
        return Promise.reject(str)
    } else {
        return Promise.resolve()
    }
}

async function deploy(project) {
    // console.log('拿到数据=>', project)
    const projectPath = project.localPath || project.name
    let isExists = await getStat(path.resolve(deployPath, projectPath));
    //如果该路径且不是文件，返回true
    if(!isExists || !isExists.isDirectory()){
        console.log('项目路径不存在！')
        return true;
    }
    let errorMsg = ''
    let finished = false
    try {
        console.log('路径=>', path.resolve(deployPath, projectPath))
        // shell.cd(path.resolve(deployPath, './' + project.name))
        errorMsg += await shell.exec('git checkout .', {cwd: path.resolve(deployPath, projectPath)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'git还原完成<br>'
        errorMsg += await shell.exec('git checkout ' + project.branch, {cwd: path.resolve(deployPath, projectPath)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'git切换分支完成<br>'
        errorMsg += await shell.exec('git pull', {cwd: path.resolve(deployPath, projectPath)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'git拉取完成<br>'
        try {
            await myDelete(path.resolve(deployPath, projectPath, '.npmrc'))
            await myDelete(path.resolve(deployPath, projectPath, 'package-lock.json'))
        } catch (e) {
            console.log(e)
        }
        errorMsg += await shell.exec('npm install', {cwd: path.resolve(deployPath, projectPath)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'npm install完成<br>'
        errorMsg += await shell.exec(project.build ? project.build : 'npm run build:stage', {cwd: path.resolve(deployPath, projectPath)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += '打包完成<br>'
        // 压缩代码
        await zipDist(project)
        errorMsg += '压缩代码成功<br>'
        // 上传服务器
        await uploadZipBySSH(project)
        errorMsg += '上传服务器成功<br>'
        finished = true
    } catch (e) {
        errorMsg += e || '未知错误'
    }
    let onlinePath = project.rootPath + '/' + project.path
    onlinePath = onlinePath.replace('///', '/')
    onlinePath = onlinePath.replace('//', '/')
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
            ip: project.ip,
            path: onlinePath,
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
        // console.log('传递数据=>', data)
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


