var express = require('express');
var router = express.Router();
const shell = require('shelljs')
var project = require('../model/projects');
var record = require('../model/record');
var server = require('../model/server');
var robot = require('../model/robot');
var clone = require('../utils/clone')
var deploy = require('../utils/deploy')
var runDeploy = require('../utils/deploy_work')
var rmdirPromise = require('../utils/delete')
const {v4:uuidv4} = require('uuid');
const os = require('os');
const task = require('../utils/task.js')



var {storagePath} = require('../config/path')
const path = require('path')
const readShell = require("../utils/readShell");
const getFullPath = require("../utils/getPullPath");
const saveShell = require("../utils/saveShell");
const mongoose = require("mongoose");
const deleteDir = require("../utils/delete");
const {promises} = require("node:fs");
const fs = require("fs");
// const uploadZipBySSH = require("../utils/uploadZipBySSH");

const getServer = async (project) => {
    return new Promise(function (resolve, reject) {
      // project.server为“0”表示本机部署
      if (project.server === '0') {
        project.ip = ''
        resolve(project)
      }
      if (project.server) {
          server.findOne({_id: project.server}, function (err, data) {
              if (err || !data) {
                  console.log('没有找到服务器信息！')
                  reject(err)
              } else {
                  const server = data.toObject()
                  project.ip = server.ip
                  project.username = server.username
                  project.password = server.password
                  // project.rootPath = server.rootPath
                  project.privateKey = server.privateKey
                  project.connectionType = server.connectionType
                  resolve(project)
              }
          })
      } else {
          reject('没有服务器id')
      }
    })
}

// 中间件，获取token
// 白名单
const whiteList = ['/users/login', '/deploy', '/task', '/add_record']
router.use(function (req, res, next) {
  console.log('req.path', req.path)
  if (whiteList.includes(req.path)) {
    next()
  } else {
    // 获取header中的SecretKey字段
    const secretkey = req.headers['secretkey']
    console.log('secretkey', secretkey)
    if (secretkey !== 'auth_gate_deploy') {
      res.send({
        code: -1,
        msg: '签名错误'
      })
      return
    }
    next()
  }
})

/* GET home page. */
router.get('/', function(req, res, next) {
  // console.log(req)
  // shell.cd('D:\\新\\lingxi-jsc')
  // shell.cd('D:\\新\\jsc\\lingxi-jsc')
  // shell.exec('npm run deploy:stage')
  res.send('test')
});
router.post('/add_project', function(req, res, next) {
  var postData = {
    name: req.body.name,
    url: req.body.url,
    branch: req.body.branch,
    server: req.body.server,
    path:req.body.path,
    build: req.body.build,
    localPath: req.body.localPath || req.body.name,
    outputDir: req.body.outputDir || 'dist',
    buildMode: req.body.buildMode || 'npm',
    eventType: req.body.eventType || 'push',
    buildShell: req.body.buildShell,
    startShell: req.body.startShell,
    tagPrefixes: req.body.tagPrefixes || ''
  };
  // 判断本地目录是否被占用
  let searchParams = {$or: [{ localPath: '',  name: postData.outputDir}, { localPath: postData.localPath }]}
  if (!req.body.localPath || req.body.name === req.body.localPath) {
    searchParams = {$or: [{ localPath: '',  name: req.body.name}, { localPath: req.body.name }]}
  }
  project.findOne(searchParams,function (err, data) {
    if(err){
      res.send({code:-1,msg:'服务器错误'})
    }else if (data) {
      res.send({code:-2,msg:'本地目录已被占用'})
    } else {
      project.create(postData, async function (err, data) {
        if (err) {
          res.send({code: -3, msg: '新增失败！'})
        }
        console.log('新增');
        // res.redirect('/userL')
        try {
          await clone(postData.url, postData.localPath || postData.name).then(() => {
            res.send({code: 0, msg: '新增成功！拉取项目成功！'})
          }).catch((error) => {
            res.send({code: 1, msg: '新增成功！拉取项目失败！' + error.stderr})
          })
        } catch (e) {
          res.send({code: 1, msg: '新增成功！拉取项目失败1！'})
        }
      })
    }
  })
  // res.send(req.body)
});
async function doTask(taskList) {
  if (!taskList.length) {
    return
  }
  for (let i = 0; i < taskList.length; i++) {
    try {
      console.log('添加任务=>', taskList[i].name)
      task.addTask(taskList[i])
    } catch (e) {
      console.log(e)
    }
  }
}
router.post('/deploy', function(req, res, next) {
  console.log('分支或tag=>', req.body.ref)  // refs/heads/dev
  console.log('项目=>', req.body?.project?.name)
  if (!(req.body?.project && req.body.project.name) || !req.body?.ref) {
    res.send({data: -2, msg: '参数缺失', body: req.body})
    return
  }
  const projectName = req.body?.project?.name
  const searchParams = {name:projectName}
  let tagName = ''
  // 判断事件类型
  if (req.body.event_name === 'tag_push') {
    tagName = req.body.ref.replace('refs/tags/', '')
    searchParams.eventType = 'tag'
  } else if (req.body.event_name === 'push') {
    searchParams.branch = req.body.ref.replace('refs/heads/', '')
    searchParams.eventType = 'push'
  } else {
    res.send({data: -3, msg: '不支持的事件类型', body: req.body})
    return
  }
  project.find(searchParams, async function (err, data) {
    if (err || !data) {
      console.log('项目不存在')
      res.send({data: -1, msg: '项目不存在'})
    } else {
      let list = data || []
      // 如果有tagName，则判断tagName是否在tagPrefixes中
      if (tagName) {
        list = list.filter(item => {
          return item.tagPrefixes && tagName.startsWith(item.tagPrefixes)
        })
      }
      if (!list.length) {
        console.log('没有找到项目')
        res.send({data: -4, msg: '没有找到项目'})
        return
      }
      const taskList = []
      let hasError = false
      for (let projectData of list) {
        if (projectData.status) {
          try {
            // deploy(data)
            projectData = projectData.toObject()
            projectData._id = projectData._id.toString()
            projectData.tagName = tagName
            const newData = await getServer(projectData)
            console.log('project', newData)
            newData.triggerBy = 'git'
            taskList.push(newData)
          } catch (e) {
            console.log(e)
            hasError = true
          }
        } else {
          console.log('项目没有开启自动部署')
        }
      }
      doTask(taskList)
      if (hasError) {
        if (taskList.length) {
          res.send({code: -1, msg: `部分启动失败：${taskList.length}任务启动成功`})
        } else {
          res.send({code: -1, msg: '启动部署失败'})
        }
      } else {
        res.send({code: 0, msg: `启动部署：${taskList.length}个部署任务`})
      }
     }
  })
});
router.get('/list', function(req, res, next) {
  project.find({},function (err,data) {
    if(err){
      res.send({data:1,msg:'查询失败'})
    }else {
      res.send({code:0,data:data})
    }
  })
});
router.get('/changeStatus', function(req, res, next) {
  const id = req.query.id
  if (id) {
    project.findOne({_id:id},function (err, data) {
      console.log(data)
      if(data){
        project.findByIdAndUpdate(id, {status:!data.status},function (err, ret) {
          if(err){
            res.send({code:1,msg:err})
          }else{
            res.send({code:0,msg:'激活成功'})
          }
        })
      }else {
        res.send({code:2,msg:'参数无效'})
      }
    });
  } else {
    res.send({code: -1, msg: '缺少id'})
  }
});
router.get('/deploy', function(req, res, next) {
  const id = req.query.id
  if (id) {
    project.findOne({_id:id}, async function (err, data) {
      if (err && !data) {
        res.send({code: -1, msg: '项目不存在'})
      } else {
        res.send({code: 0, msg: '启动部署'})
        try {
          // console.log('项目=>', data)
          data = data.toObject()
          data._id = data._id.toString()
          const newData = await getServer(data)
          console.log('项目=>', newData)
          // 从header获取用户信息
          const userName = req.headers.username
          newData.triggerBy = userName
          task.addTask(newData)
        } catch (e) {
          console.log(e)
        }
      }
    })
  } else {
    res.send({code: -1, msg: '缺少id'})
  }
});

router.post('/update', function(req, res, next) {
  var postData = {
    name: req.body.name,
    url: req.body.url,
    branch: req.body.branch,
    path:req.body.path,
    server:req.body.server,
    _id: req.body._id,
    build: req.body.build,
    localPath: req.body.localPath || req.body.name,
    outputDir: req.body.outputDir || '',
    buildMode: req.body.buildMode,
    eventType: req.body.eventType,
    buildShell: req.body.buildShell,
    startShell: req.body.startShell,
    tagPrefixes: req.body.tagPrefixes
  };
  project.findOne({_id:postData._id},function (err, data) {
    if(err || !data){
      res.send({code:1,msg:'项目不存在'})
    }else {
      // 判断本地路径是否被占用
      let searchParams = {_id: {$ne: postData._id}, $or: [{ localPath: '',  name: postData.outputDir}, { localPath: postData.localPath }]}
      if (!req.body.localPath || req.body.name === req.body.localPath) {
        searchParams = {_id: {$ne: postData._id}, $or: [{ localPath: '',  name: req.body.name}, { localPath: req.body.name }]}
      }
      project.findOne(searchParams,function (err, data) {
        if (err) {
          res.send({code: -1, msg: '服务器错误'})
        } else if (data) {
          res.send({code: -2, msg: '本地目录已被占用'})
        } else {
          project.update({_id:postData._id}, postData, function (err, ret) {
            if(err){
              res.send({code:2,msg:"编辑失败！"})
            }else {
              res.send({code:0,msg:"编辑成功！"})
            }
          })
        }
      })
    }
  })
  // res.send(req.body)
});

router.get('/remove', function(req, res, next) {
  const id = req.query.id
  if (id) {
    project.findByIdAndRemove(req.query.id,function (err,data) {
      if(err){
        res.send({code:1,msg:'删除失败'})
      }else {
        res.send({code:0,msg:"删除成功"})
        console.log(data.name)
        try {
          rmdirPromise(path.resolve(storagePath, './' + data.localPath))
        } catch (e) {
          console.log(e)
        }
      }
    })
  } else {
    res.send({code: -1, msg: '缺少id'})
  }
});
router.post('/add_record', function(req, res, next) {
  const id = req.body.id
  console.log(req.body)
  if (id) {
    record.create({
      project_id: id,
      name: req.body.name,
      branch: req.body.branch,
      ip: req.body.ip,
      path: req.body.path,
      log: req.body.log,
      success: req.body.success,
      triggerBy: req.body.triggerBy
    }, function (err, data) {
      if (!err) {
        console.log('记录成功')
        res.send({code: 0, msg: '记录成功'})
      } else {
        console.log('记录失败')
        res.send({code: 1, msg: '记录失败'})
      }
    })
  } else {
    res.send({code: -1, msg: '缺少id'})
  }
});
router.get('/record_list', function(req, res, next) {
  const id = req.query.project_id
  if (id) {
    record.find({project_id: id}, {log: 0},function (err,data) {
      if(err){
        res.send({code:1,msg:'查询失败'})
      }else {
        for (let a = 0; a < data.length; a++) {
          data[a] = data[a].toObject()
          data[a].shijian = data[a].createTime.valueOf()
        }
        res.send({code:0,data:data})
      }
    }).sort({createTime: -1}).limit(100)
  } else {
    record.find({}, {log: 0},function (err,data) {
      if(err){
        res.send({code:1,msg:'查询失败'})
      }else {
        for (let a = 0; a < data.length; a++) {
          data[a] = data[a].toObject()
          data[a].shijian = data[a].createTime.valueOf()
        }
        res.send({code:0,data:data})
      }
    }).sort({createTime: -1}).limit(100)
  }

});

// 日志详情
router.get('/record_detail', function(req, res, next) {
  const id = req.query.id
  if (id) {
    record.findOne({_id:id},function (err, data) {
      if(err){
        res.send({code:1,msg:'查询失败'})
      }else {
        res.send({code:0,data:data.log})
      }
    })
  } else {
    res.send({code: -1, msg: '缺少id'})
  }
});
router.post('/add_server', function (req, res, next) {
    var postData = {
        name: req.body.name,
        ip: req.body.ip,
        // rootPath:req.body.rootPath,
        password:req.body.password,
        connectionType:req.body.connectionType,
        privateKey:req.body.privateKey,
        username: req.body.username
    };
    server.findOne({ip:postData.name},function (err, data) {
        if(err){
            res.send({code:-1,msg:'服务器错误'})
        }else if (data) {
            res.send({code:-2,msg:'服务器信息已经存在'})
        } else {
            server.create(postData, async function (err, data) {
                if (err) {
                    res.send({code: -3, msg: '新增失败！'})
                }
                console.log('新增');
                res.send({code: 0, msg: '添加服务器成功！'})
            })
        }
    })
})
router.post('/update_server', function(req, res, next) {
    var postData = {
        name: req.body.name,
        ip: req.body.ip,
        // rootPath:req.body.rootPath,
        password:req.body.password,
        username: req.body.username,
        connectionType:req.body.connectionType,
        privateKey:req.body.privateKey,
        _id: req.body._id
    };
    server.findOne({_id:postData._id},function (err, data) {
        if(err || !data){
            res.send({code:1,msg:'项目不存在'})
        }else {
            server.update({_id:postData._id}, postData, function (err, ret) {
                if(err){
                    res.send({code:2,msg:"编辑失败！"})
                }else {
                    res.send({code:0,msg:"编辑成功！"})
                }
            })
        }
    })
    // res.send(req.body)
});
router.get('/server_list', function (req, res, next) {
    server.find({},function (err,data) {
        if(err){
            res.send({data:1,msg:'查询失败'})
        }else {
            res.send({code:0,data:data})
        }
    })
})
router.get('/remove_server', function(req, res, next) {
    const id = req.query.id
    if (id) {
        server.findByIdAndRemove(req.query.id,function (err,data) {
            if(err){
                res.send({code:1,msg:'删除失败'})
            }else {
                res.send({code:0,msg:"删除成功"})
                console.log(data.name)
            }
        })
    } else {
        res.send({code: -1, msg: '缺少id'})
    }
});
router.get('/change_server_status', function(req, res, next) {
    const id = req.query.id
    if (id) {
        server.findOne({_id:id},function (err, data) {
            console.log(data)
            if(data){
                server.findByIdAndUpdate(id, {status:!data.status},function (err, ret) {
                    if(err){
                        res.send({code:1,msg:err})
                    }else{
                        res.send({code:0,msg:'激活成功'})
                    }
                })
            }else {
                res.send({code:2,msg:'参数无效'})
            }
        });
    } else {
        res.send({code: -1, msg: '缺少id'})
    }
});
router.post('/add_shell', async function (req, res, next) {
    const content = req.body.content
    if (!content) {
        res.send({code: -1, msg: '缺少内容'})
        return
    }
    const platform = os.platform();
    console.log(platform)
    try {
        console.log('保存shell')
        const name = `${uuidv4()}.${platform === 'win32' ? 'cmd' : 'sh'}`
        await saveShell(getFullPath(name, 'shell'), content)
        res.send({code: 0, msg: '保存成功', data: {name}})
    } catch (e) {
        res.send({code: -1, msg: e || '保存失败', error: e})
    }
})
router.post('/update_shell', async function (req, res, next) {
    const content = req.body.content
    const name = req.body.name
    if (!content || !name) {
        res.send({code: -1, msg: '缺少参数'})
        return
    }
    try {
        await saveShell(getFullPath(name, 'shell'), content)
        res.send({code: 0, msg: '保存成功', data: {name}})
    } catch (e) {
        res.send({code: -1, msg: e || '保存失败', error: e})
    }
})

router.get('/get_shell_content', async function (req, res, next) {
    const name = req.query.name
    if (!name) {
        res.send({code: -1, msg: '缺少参数'})
        return
    }
    try {
        const content = await readShell(getFullPath(name, 'shell'))
        res.send({code: 0, msg: '保存成功', data: {content}})
    } catch (e) {
        res.send({code: -1, msg: '保存失败', error: e})
    }
})

router.get('/get_server_ip', async function (req, res, next) {
  const networks = os.networkInterfaces();
  let ip = ''
  for (const name of Object.keys(networks)) {
    for (const network of networks[name]) {
      if (network.family === 'IPv4' && !network.internal) {
        ip = network.address
        break
      }
    }
    if (ip) {
      break
    }
  }
  res.send({
    code: 0,
    data: {
      ip
    }
  })
})

router.get('/clone_project', async function (req, res, next) {
  const id = req.query.id
  if (!id) {
    res.send({code: -1, msg: '缺少参数'})
    return
  }
  try {
    const data = await project.findOne({_id: id})
    if (!data) {
      res.send({code: -1, msg: '项目不存在'})
      return
    }
    const localPath = getFullPath(data.localPath || data.name, 'storage')
    // 判断localPath是否存在
    try {
        await fs.promises.access(localPath)
        // 重命名localPath
        // 生成随机字符串
        const newLocalPath = getFullPath(`${uuidv4()}_${data.localPath || data.name}`, 'storage')
        await promises.rename(localPath, newLocalPath)
        deleteDir(newLocalPath)
    } catch (e) {
      console.log(e)
    }

    await clone(data.url, data.localPath || data.name)
    res.send({code: 0, msg: '克隆成功', data})
  }catch (e) {
    console.log(e)
    res.send({code: -1, msg: '克隆失败', error: e})
  }
})

router.get('/task', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // 发送初始状态
  task.sendTaskList(res);

  // 添加新客户端
  global.sseClients.add(res);

  // 断开连接处理
  req.on('close', () => {
    global.sseClients.delete(res);
    res.end();
  });
  if (global.activeWorkers) {
    const keys = Object.keys(global.activeWorkers);
    for (const key of keys) {
      const worker = global.activeWorkers[key];
      worker.postMessage({
        type: 'initLog',
      });
    }
  }
});

// 终止当前任务
router.get('/stop_curr', async (req, res) => {
  if (global.activeWorkers) {
    // 获取keys
    const keys = Object.keys(global.activeWorkers);
    for (const key of keys) {
      const worker = global.activeWorkers[key];
      worker.postMessage({
        type: 'stop',
      });
      await worker.terminate()
    }
    res.send({
      code: 0,
      msg: '停止成功',
    });
  }
})

// 取消等待中的任务
router.get('/cancel_task', async (req, res) => {
  if (req.query.id) {
    console.log(req.query.id)
    task.removeTask(req.query.id)
    try {
      res.send({
        code: 0,
        msg: '取消成功',
      });
    } catch (e) {
      res.send({
        code: -1,
        msg: '取消失败',
        error: e
      });
    }
  } else {
    res.send({
      code: -1,
      msg: '缺少id',
    });
  }
})

// 设置机器人webhook
router.post('/set_webhook', async (req, res) => {
  const {webhook} = req.body
  if (!webhook && webhook !== '') {
    res.send({
      code: -1,
      msg: '缺少url',
    });
    return
  }
  try {
    // 查询mongodb中的数据
    const data = await robot.findOne({})
    // 如果有更改
    if (data && data.webhook !== webhook) {
      // 更新
      await robot.updateOne({}, {webhook})
    } else if (!data) {
      // 新增
      await robot.create({webhook})
    }
    res.send({
      code: 0,
      msg: '设置成功',
    });
  } catch (e) {
    res.send({
      code: -1,
      msg: '设置失败',
      error: e
    });
  }
})

// 查询机器人webhook
router.get('/get_webhook', async (req, res) => {
  try {
    // 查询mongodb中的数据
    const data = await robot.findOne({})
    res.send({
      code: 0,
      msg: '查询成功',
      data
    });
  } catch (e) {
    res.send({
      code: -1,
      msg: '查询失败',
      error: e
    });
  }
})

module.exports = router;
