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
const simpleDelete = require("./simpleDelete");
const simpleCopy = require("./simpleCopy");
const {v4:uuidv4} = require('uuid');
// let mongoose=require('mongoose');
// 记录shell子进程
let childProcess = null
// 记录耗时
const startTime = Date.now()

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
                privateKeyPath: path.resolve(project.privateKey), //秘钥登录(推荐) 方式一
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
        console.log('连接失败', error)
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
        // 产出物路径不一定是dist,需要取产出物路径的最后一级
        let outputDir = project.outputDir || 'dist'
        const zipName = path.basename(outputDir) // 解压后的文件夹名
        await runCommand(`mv -f ${onlinePath}/${zipName}/*  ${onlinePath}`, onlinePath)
        await runCommand(`rm -rf ${onlinePath}/${zipName}`, onlinePath) // 移出后删除 dist 文件夹
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
    if (str.indexOf('err') !== -1 || str.indexOf('ERR') !== -1 || str.indexOf('killed') !== -1 || str.indexOf('Killed') !== -1) {
        return Promise.reject('错误，终止')
    } else {
        return Promise.resolve('')
    }
}

async function runLocalShellCommand(command, options) {
    if (!options) {
        options = {}
    }
    console.log('执行命令', command, JSON.stringify(options))
    // 创建子进程
    childProcess = shell.exec(command, { ...options, async: true });

    let res = ''
    // 封装为 Promise
    return new Promise((resolve, reject) => {
        // 监听退出事件
        childProcess.on("exit", (code) => {
            console.log('shell code', code)
            if (code === 0) {
                resolve(res);
            } else {
                reject(new Error(`命令执行失败，退出码: ${code}, message： ${res || 'null'}`));
            }
        });
        childProcess.stdout.on('data', function(data) {
            /* ... do something with data ... */
            // console.log(data)
            res += data
        });

        // 监听错误事件
        childProcess.on("error", (err) => {
            reject(err);
        });
    });
}

const runShell = async(project, shellType = 'buildShell') => {
    console.log('开始执行shell脚本', project[shellType])
    const directoryName = project.localPath || project.name
    // 在项目路径下运行shell脚本
    try {
        const res = await runLocalShellCommand(getFullPath(project[shellType], 'shell'), {cwd: path.resolve(storagePath, directoryName)})
        return `执行脚本${project[shellType]}<br>` + res + '<br>'
    } catch (e) {
        return `执行脚本失败${project[shellType]}<br> error: ` + (e.message || e) + '<br>'
    }
}

// 执行远程脚本
const runRemoteShell = async(localPath, remotePath) => {
    console.log('runRemoteShell')
    // 随机生成文件名
    const shellName = `${uuidv4()}.sh`
    let shellPath = remotePath + '/' + shellName
    shellPath = shellPath.replace('//', '/')
    await SSH.putFiles([{ local: localPath, remote: shellPath }])
    // 设置脚本文件执行权限
    await SSH.exec('chmod', ['777', shellPath])
    let res = ''
    // 执行脚本文件
    try {
        res = await runCommand('./' + shellName, remotePath )
    }catch (e) {
        console.log(e)
    }

    try {
        await runCommand('rm -f ./' + shellName, remotePath )
    } catch (e) {
        console.error('删除脚本失败', e)
    }

    // 断开连接
    await SSH.dispose()
    return '执行远程脚本成功<br>' + res
}

// 复制产出物到部署路径
const copyDist = async(project) => {
    let errorMsg = ''
    let deployPath = project.path
    let outputDir = project.outputDir
    const localPath = project.localPath || project.name
    if (deployPath && outputDir) {
        // if (deployPath[0] === '/') {
        //     deployPath = deployPath.replace('/', '')
        // }
        // const fullDeployPath = path.resolve(deployRootPath,'./', deployPath)
        let isExists = await getStat(deployPath);
        //如果该路径且不是文件，返回true
        console.log(deployRootPath, deployPath)
        if(!isExists || !isExists.isDirectory()){
            console.log('项目路径不存在！')
            // todo 创建文件夹
            await fs.promises.mkdir(deployPath, {recursive: true})
            errorMsg += '创建文件夹成功<br>'
        }
        // 清空部署目录
        await simpleDelete(deployPath)
        errorMsg += '清空部署目录<br>'
        // 复制打包文件到部署目录
        if (outputDir[0] === '/') {
            outputDir = outputDir.replace('/', '')
        }
        await simpleCopy(path.resolve(storagePath, localPath, './', outputDir), deployPath)
        errorMsg += '复制打包文件到部署目录<br>'
    }
    return errorMsg
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
        errorMsg += await runLocalShellCommand('git checkout .', {cwd: path.resolve(storagePath, projectPath)}) + '<br>'
        await isError(errorMsg)
        errorMsg += 'git还原完成<br>'
        errorMsg += await runLocalShellCommand('git pull', {cwd: path.resolve(storagePath, projectPath)}) + '<br>'
        if (project.eventType === 'push') {
            errorMsg += await runLocalShellCommand('git checkout ' + project.branch, {cwd: path.resolve(storagePath, projectPath)}) + '<br>'
        } else {
            errorMsg += await runLocalShellCommand('git checkout tags/' + project.tagName, {cwd: path.resolve(storagePath, projectPath)}) + '<br>'
        }
        await isError(errorMsg)
        errorMsg += 'git切换分支完成<br>'
        errorMsg += await runLocalShellCommand('git pull', {cwd: path.resolve(storagePath, projectPath)}) + '<br>'
        await isError(errorMsg)
        errorMsg += 'git拉取完成<br>'
        // try {
        //     await myDelete(path.resolve(deployRootPath, projectPath, '.npmrc'))
        //     await myDelete(path.resolve(deployRootPath, projectPath, 'package-lock.json'))
        // } catch (e) {
        //     console.log(e)
        // }
        // 判断path是否为空，或者只包含一个/
        console.log('path=>', project.path)
        console.log('path.split=>', project.path.split('\\'))
        if (!project.path || project.path === '/' || (project.path.split('/').length === 1 && project.path.split('\\').length === 1)) {
            errorMsg += 'error：部署路径有误，请修改，必须包含两个及以上“/”' + '<br>'
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
            // await runLocalShellCommand('npm cache clean --force', {cwd: path.resolve(storagePath, projectPath)}) + '<br>'

            console.log('开始执行npm命令')
            // 若有打包命令则执行，否则默认npm run build:stage
            errorMsg += await runLocalShellCommand('npm install', {cwd: path.resolve(storagePath, projectPath)}) + '<br>'
            await isError(errorMsg)
            errorMsg += 'npm install完成<br>'
            errorMsg += await runLocalShellCommand(project.build ? project.build : 'npm run build:stage', {cwd: path.resolve(storagePath, projectPath)}) + '<br>'
            await isError(errorMsg)
            errorMsg += '打包完成<br>'
            await sleep(500)
            if (project.ip) {
                // 压缩代码
                await zipDist(project)
                errorMsg += '压缩代码成功<br>'
                await sleep(2000)
                // 上传服务器
                await uploadZipBySSH(project)
                errorMsg += '上传服务器成功<br>'
            } else {
                const copyRes = await copyDist(project)
                errorMsg += copyRes
            }
            finished = true
            console.log('npm 部署完成')
        } else {
            // 运行shell脚本
            if(project.buildShell) {
                errorMsg += await runShell(project, 'buildShell')
                console.log('shell脚本执行完成-build', errorMsg)
                await isError(errorMsg)
            }
            await sleep(500)
            if (project.ip) {
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
            } else {
                const copyRes = await copyDist(project)
                errorMsg += copyRes
            }
            finished = true
        }

    } catch (e) {
        errorMsg += e || '未知错误'
    }
    // 计算耗时, 如果超过60秒转为MM分ss秒
    let executionTime = Date.now() - startTime
    if (executionTime > 60000) {
        executionTime = Math.round(executionTime / 60000) + '分' + Math.round((executionTime % 60000) / 1000) + '秒'
    } else {
        executionTime = Math.round(executionTime / 1000) + '秒'
    }
    console.log('部署完成，耗时=>', executionTime)
    const options = {
        timeZone: 'Asia/Shanghai', // 亚洲/上海时区即东八区
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 使用24小时制
    };

    errorMsg += '<br>耗时=>' + executionTime + '<br>结束时间=>' + new Date().toLocaleString('zh-CN', options)
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
        // 向父线程发送结束消息
        setTimeout(function () {
            parentPort.postMessage({
                type: 'finish'
            })
        }, 2000)
    });
    // 发送微信通知
    sendWxNotice(project, finished)
}

function isDockerEnvironment() {
    return process.env.DOCKER === 'yes';
}

const runDeploy = (data) => {
    if (isMainThread) {
        return new Promise(async (resolve, reject) => {
            // 以项目id作为任务号
            const projectId = data._id
            if (global.activeWorkers[projectId]) {
                try {
                    console.log('正在运行中，终止旧线程')
                    const runningWorker = global.activeWorkers[projectId]
                    runningWorker.postMessage({
                        type: 'stop'
                    })
                    await runningWorker.terminate()
                    console.log('已终止')
                } catch (e) {
                    console.log('终止旧线程失败', e)
                }
            }
            console.log('启动新线程')
            const worker = new Worker(__filename, {
                // workerData: JSON.parse(JSON.stringify(data._doc))
                workerData: data
            });
            global.activeWorkers[projectId] = worker
            worker.on('message', (d) => {
                console.log('parent receive message:', d);
                if (d.type === 'finish') {
                    console.log('子线程运行完毕，正常退出')
                    worker.terminate()
                    delete global.activeWorkers[projectId]
                    resolve()
                }
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
                delete global.activeWorkers[projectId]
                // docker内重启，解决ssh第二次连接异常退出的问题
                const isDocker = isDockerEnvironment()
                // console.log('isDocker', isDocker)
                if (isDocker) {
                    // process.exit(0);
                }
                resolve()
            });
            // 超时自动停止
            const timer = setTimeout(() => {
                console.log('超时自动停止')
                worker.terminate()
            }, 30 * 60 * 1000)
        })
    }
}
if (!isMainThread) {
    deploy(workerData)
    parentPort.on('message', (data) => {
        console.log('child receive message:', data);
        if (data.type === 'stop') {
            console.log('收到停止指令');
            childProcess.kill(); // 终止子进程
            process.exit();      // 退出Worker线程
        }
    })
}

module.exports = runDeploy;


