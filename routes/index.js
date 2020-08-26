var express = require('express');
var router = express.Router();
const shell = require('shelljs')
var project = require('../model/projects');
var record = require('../model/record');
var server = require('../model/server');
var clone = require('../utils/clone')
var deploy = require('../utils/deploy')
var runDeploy = require('../utils/deploy_work')
var rmdirPromise = require('../utils/delete')



var deployPath = require('../config/path')
const path = require('path')

const getServer = async (project) => {
    return new Promise(function (resolve, reject) {
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
                    project.rootPath = server.rootPath
                    resolve(project)
                }
            })
        } else {
            reject('没有服务器id')
        }
    })
}

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
    build: req.body.build
  };
  project.findOne({name:postData.name, branch:postData.branch},function (err, data) {
    if(err){
      res.send({code:-1,msg:'服务器错误'})
    }else if (data) {
      res.send({code:-2,msg:'项目已经存在'})
    } else {
      project.create(postData, async function (err, data) {
        if (err) {
          res.send({code: -3, msg: '新增失败！'})
        }
        console.log('新增');
        // res.redirect('/userL')
        try {
          await clone(postData.url, postData.name).then(() => {
            res.send({code: 0, msg: '新增成功！拉取项目成功！'})
          }).catch(() => {
            res.send({code: 1, msg: '新增成功！拉取项目失败！'})
          })
        } catch (e) {
          res.send({code: 1, msg: '新增成功！拉取项目失败1！'})
        }
      })
    }
  })
  // res.send(req.body)
});
router.post('/deploy', function(req, res, next) {
  console.log('分支=>', req.body.ref)  // refs/heads/dev
  console.log('项目=>', req.body.project.name)
  if (!(req.body.project && req.body.project.name) || !req.body.ref) {
    res.send({data: -2, msg: '参数缺失'})
    return
  }
  const projectName = req.body.project.name
  const branch = req.body.ref.replace('refs/heads/', '')
  project.findOne({name:projectName, branch:branch}, async function (err, data) {
    if (err || !data) {
      console.log('项目不存在')
      res.send({data: -1, msg: '项目不存在'})
    } else {
      if (data.status) {
        res.send({code: 0, msg: '启动部署'})
        try {
          console.log('项目信息=>', data)
          // deploy(data)
          data = data.toObject()
          data._id = data._id.toString()
          const newData = await getServer(data)
          runDeploy(newData)
        } catch (e) {
          console.log(e)
        }
      } else {
        console.log('项目没有开启自动部署')
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
          runDeploy(newData)
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
    build: req.body.build
  };
  project.findOne({_id:postData._id},function (err, data) {
    if(err || !data){
      res.send({code:1,msg:'项目不存在'})
    }else {
      project.update({_id:postData._id}, postData, function (err, ret) {
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

router.get('/remove', function(req, res, next) {
  const id = req.query.id
  if (id) {
    project.findByIdAndRemove(req.query.id,function (err,data) {
      if(err){
        res.send({code:1,msg:'删除失败'})
      }else {
        res.send({code:0,msg:"删除成功"})
        console.log(data.name)
        rmdirPromise(path.resolve(deployPath, './' + data.name))
      }
    })
  } else {
    res.send({code: -1, msg: '缺少id'})
  }
});
router.get('/add_record', function(req, res, next) {
  const id = req.query.id
  if (id) {
    record.create({
        project_id: id,
        name: req.query.name,
        branch: req.query.branch,
        ip: req.query.ip,
        path: req.query.path
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
  record.find({}, function (err,data) {
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
});
router.post('/add_server', function (req, res, next) {
    var postData = {
        name: req.body.name,
        ip: req.body.ip,
        rootPath:req.body.rootPath,
        password:req.body.password,
        username: req.body.username
    };
    server.findOne({ip:postData.name, rootPath:postData.rootPath},function (err, data) {
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
        rootPath:req.body.rootPath,
        password:req.body.password,
        username: req.body.username,
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


module.exports = router;
