const shell = require('shelljs')
var deployPath = require('../config/path')
const zipFile = require('compressing')
const node_ssh = require('node-ssh') // ssh连接服务器
const SSH = new node_ssh()
const path = require('path')
const fs = require('fs')
let { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
let request = require("request");
// let mongoose=require('mongoose');


//等待两秒
// const wait2s = async () => {
//     await setTimeout(function () {
//         console.log('......')
//     }, 2000)
// }

// 压缩代码
const zipDist = async(project) => {
    const distDir = path.resolve(deployPath, './' + project.name, './dist') // 待打包
    const distZipPath = path.resolve(deployPath, './' + project.name, './dist.zip')
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
    const distZipPath = path.resolve(deployPath, './' + project.name, './dist.zip')
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
        // record.create({
        //     project_id: id
        // }, function (err, data) {
        //     if (!err) {
        //         console.log('记录成功')
        //     } else {
        //         console.log('err', err)
        //     }
        // })
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

async function deploy(project) {
    let isExists = await getStat(path.resolve(deployPath, project.name));
    //如果该路径且不是文件，返回true
    if(!isExists || !isExists.isDirectory()){
        console.log('项目路径不存在！')
        return true;
    }
    console.log('路径=>', path.resolve(deployPath, project.name))
    // shell.cd(path.resolve(deployPath, './' + project.name))
    await shell.exec('git pull', {cwd: path.resolve(deployPath, project.name)})
    // console.log('拉取成功')
    await shell.exec('git checkout ' + project.branch, {cwd: path.resolve(deployPath, project.name)})
    await shell.exec('npm install', {cwd: path.resolve(deployPath, project.name)})
    // console.log('正在打包...')
    await shell.exec(project.build ? project.build : 'npm run build:stage', {cwd: path.resolve(deployPath, project.name)})
    request('http://localhost:3210/add_record?id=' + project._id.toString() + '&name=' + project.name + '&branch=' + project.branch , function (error, response, body) {
        if (!error) {
            console.log(body);
        }
    });
    // console.log('打包成功')
    // try {
    //     // 压缩代码
    //     await zipDist(project)
    //     // 上传服务器
    //     await uploadZipBySSH(project)
    //     // console.log(mongoose.Types.ObjectId(project._id).toString())
    // } catch (e) {
    //     console.log(e)
    // }

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


