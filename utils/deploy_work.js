const shell = require('shelljs')
var { deployRootPath, storagePath, zipPath} = require('../config/path')
const zipFile = require('compressing')
const SSH = require('./ssh')
const path = require('path')
const fs = require('fs')
let { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
let request = require("request");
const myDelete = require('./delete')
const getFullPath = require("./getPullPath");
const readShell = require('./readShell')
const rmdirPromise = require("./delete");
const sendWxNotice = require("./sendWxNotice");
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
    const distDir = path.resolve(storagePath, './' + (project.localPath || project.name), './', outputDir) // 待打包
    // 在zipPath下创建项目压缩包文件夹
    const projectZipPath = path.resolve(zipPath, './' + (project.localPath || project.name))
    // 判断项目压缩包文件夹是否存在
    try {
        await fs.promises.access(projectZipPath)
    } catch (error) {
        console.log('项目压缩包文件夹不存在，创建中...')
        await fs.promises.mkdir(projectZipPath)
    }
    const distZipPath = path.resolve(zipPath, './' + (project.localPath || project.name), './dist.zip')
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
const runCommand = async(command, s_path) => {
    // eslint-disable-next-line no-unused-vars
    console.log('执行命令', command, s_path)
    const result = await SSH.exec(command, [], { cwd: s_path })
    return result
    // defaultLog(result);
}

// 清空线上目标目录里的旧文件
const clearOldFile = async(path) => {
    if (!path || path === '/' || path === './' || path.length < 10) {
        return Promise.reject('error：路径不完整')
    }
    const commands = ['ls', 'rm -rf *']
    await Promise.all(commands.map(async(it) => {
        return await runCommand(it, path)
    }))
}

const sleep = (time) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, time)
    })
}

// 传送zip文件到服务器
const uploadZipBySSH = async(project) => {
    if (!project.path || project.path === '/') {
        console.log('路径不完整', project.path)
        return false
    }
    let onlinePath = project.path
    onlinePath = onlinePath.replace('///', '/')
    onlinePath = onlinePath.replace('//', '/')
    console.log('onlinePath', onlinePath, project)
    // 连接ssh
    await connectSSH(project)
    // 创建目录
    await runCommand(`mkdir -p ${onlinePath}`)
    try {
        // 判断远程是否支持 unzip命令
        const isUnzip = await runCommand(`command -v unzip`)
        if (!isUnzip) {
            if (await runCommand(`command -v yum`)) {
                await runCommand(`yum install unzip -y`)
            } else if (await runCommand(`command -v apt-get`)) {
                await runCommand(`apt-get install unzip -y`)
            }
        }
        // 线上目标文件清空
        console.log('正在清空...')
        await clearOldFile(onlinePath)
        console.log('正在上传...')
        const distZipPath = path.resolve(zipPath, './' + (project.localPath || project.name), './dist.zip')
        console.log('distZipPath', distZipPath)
        await SSH.putFiles([{ local: distZipPath, remote: onlinePath + '/dist.zip' }]) // local 本地 ; remote 服务器 ;
        console.log('正在解压...')
        await runCommand('unzip ./dist.zip', onlinePath) // 解压
        await runCommand(`rm -rf ${onlinePath}/dist.zip`, onlinePath) // 解压完删除线上压缩包
        // 将目标目录的dist里面文件移出到目标文件
        // 举个例子 假如我们部署在 /test/html 这个目录下 只有一个网站, 那么上传解压后的文件在 /test/html/dist 里
        // 需要将 dist 目录下的文件 移出到 /test/html ;  多网站情况, 如 /test/html/h5  或者 /test/html/admin 都和上面同样道理
        await runCommand(`mv -f ${onlinePath}/dist/*  ${onlinePath}`, onlinePath)
        await runCommand(`rm -rf ${onlinePath}/dist`, onlinePath) // 移出后删除 dist 文件夹
        SSH.dispose() // 断开连接
        const id = project._id.toString()
        console.log(id)
        return Promise.resolve('上传成功')
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
        return Promise.reject('错误，终止')
    } else {
        return Promise.resolve('')
    }
}

const runShell = async(project, shellType = 'buildShell') => {
    console.log('开始执行shell脚本', project[shellType])
    const directoryName = project.directoryName || project.name
    // 在项目路径下运行shell脚本
    const res = await shell.exec(getFullPath(project[shellType], 'shell'), {cwd: path.resolve(storagePath, directoryName)})
    if (res.code === 0) {
        return `执行脚本${project[shellType]}<br>` + res.stdout + '<br>'
    } else {
        return `执行脚本失败${project[shellType]}<br> error: ` + res.stderr + '<br>'
    }
}

// 执行远程脚本
const runRemoteShell = async(localPath, remotePath) => {
    console.log('runRemoteShell')
    let shellPath = remotePath + '/run.sh'
    shellPath = shellPath.replace('//', '/')
    await SSH.putFiles([{ local: localPath, remote: shellPath }])
    // 设置脚本文件执行权限
    await SSH.exec('chmod', ['777', shellPath])
    let res = ''
    // 执行脚本文件
    try {
        res = await runCommand('./run.sh', remotePath )
    }catch (e) {
        console.log(e)
    }
    // 断开连接
    await SSH.dispose()
    return '执行远程脚本成功<br>' + res
}

async function deploy(project) {
    const projectPath = project.localPath || project.name
    console.log('开始部署...', storagePath, projectPath)
    let isExists = await getStat(path.resolve(storagePath, projectPath));
    //如果该路径且不是文件，返回true
    if(!isExists || !isExists.isDirectory()){
        console.log('项目路径不存在！')
        return Promise.reject('项目路径不存在！')
    }
    let errorMsg = ''
    let finished = false
    try {
        console.log('路径=>', path.resolve(storagePath, projectPath))
        // shell.cd(path.resolve(deployRootPath, './' + project.name))
        errorMsg += await shell.exec('git checkout .', {cwd: path.resolve(storagePath, projectPath)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'git还原完成<br>'
        errorMsg += await shell.exec('git pull', {cwd: path.resolve(storagePath, projectPath)}).stderr + '<br>'
        if (project.eventType === 'push') {
            errorMsg += await shell.exec('git checkout ' + project.branch, {cwd: path.resolve(storagePath, projectPath)}).stderr + '<br>'
        } else {
            errorMsg += await shell.exec('git checkout tags/' + project.tagName, {cwd: path.resolve(storagePath, projectPath)}).stderr + '<br>'
        }
        await isError(errorMsg)
        errorMsg += 'git切换分支完成<br>'
        errorMsg += await shell.exec('git pull', {cwd: path.resolve(storagePath, projectPath)}).stderr + '<br>'
        await isError(errorMsg)
        errorMsg += 'git拉取完成<br>'
        // try {
        //     await myDelete(path.resolve(deployRootPath, projectPath, '.npmrc'))
        //     await myDelete(path.resolve(deployRootPath, projectPath, 'package-lock.json'))
        // } catch (e) {
        //     console.log(e)
        // }
        // 判断path是否为空，或者只包含一个/
        if (!project.path || project.path === '/' || project.path.split('/').length === 1 || project.path.indexOf('/') !== 0) {
            errorMsg += 'error：远程部署路径有误，请修改，必须包含两个及以上“/”，且以“/”开头' + '<br>'
            await isError(errorMsg)
        }
        if (project.buildMode === 'npm') {
            // 删除node_modules目录
            // try{
            //     await rmdirPromise(path.resolve(storagePath, projectPath, 'node_modules'))
            // } catch (e) {
            //     console.log('尝试删除node_modules失败=>', e)
            // }
            //
            // // 清空npm缓存
            // await shell.exec('npm cache clean --force', {cwd: path.resolve(storagePath, projectPath)}).stderr + '<br>'

            console.log('开始执行npm命令')
            // 若有打包命令则执行，否则默认npm run build:stage
            errorMsg += await shell.exec('npm install', {cwd: path.resolve(storagePath, projectPath)}).stderr + '<br>'
            await isError(errorMsg)
            errorMsg += 'npm install完成<br>'
            errorMsg += await shell.exec(project.build ? project.build : 'npm run build:stage', {cwd: path.resolve(storagePath, projectPath)}).stderr + '<br>'
            await isError(errorMsg)
            errorMsg += '打包完成<br>'
            // 压缩代码
            await zipDist(project)
            errorMsg += '压缩代码成功<br>'
            await sleep(2000)
            // 上传服务器
            await uploadZipBySSH(project)
            errorMsg += '上传服务器成功<br>'
            finished = true
            console.log('npm 部署完成')
        } else {
            // 运行shell脚本
            if(project.buildShell) {
                errorMsg += await runShell(project, 'buildShell')
                console.log('shell脚本执行完成-build', errorMsg)
                await isError(errorMsg)
            }
            // 上传服务器
            await zipDist(project)
            await uploadZipBySSH(project)
            await isError(errorMsg)
            errorMsg += '上传服务器成功<br>'
            // 执行启动脚本
            if (project.startShell) {
                // 获取shell内容
                // const content = await readShell(getFullPath(project['startShell'], 'shell'))
                // if (content) {
                await connectSSH(project)
                errorMsg += await runRemoteShell(getFullPath(project['startShell'], 'shell'), project.path)
                // }
            }
            finished = true
        }

    } catch (e) {
        errorMsg += e || '未知错误'
    }
    let onlinePath = project.path
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
            tagName: project.tagName,
            eventType: project.eventType,
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
    // 发送微信通知
    sendWxNotice(project, finished)
}

function isDockerEnvironment() {
    return process.env.DOCKER === 'yes';
}

const runDeploy = (data) => {
    if (isMainThread) {
        console.log('启动新线程')
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
            if (timer) {
                clearTimeout(timer)
            }
            if (code !== 0) {
                console.error(`工作线程使用退出码 ${code} 停止`);
            } else {
                console.log('工作线程正常退出')
            }
            // docker内重启，解决ssh第二次连接异常退出的问题
            const isDocker = isDockerEnvironment()
            console.log('isDocker', isDocker)
            if (isDocker) {
                process.exit(0);
            }
        });
        // 超时自动停止
        const timer = setTimeout(() => {
            worker.terminate()
        }, 10 * 60 * 1000)
    }
}
if (!isMainThread) {
    deploy(workerData)
}

module.exports = runDeploy;


