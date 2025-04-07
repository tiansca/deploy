var express = require('express');
var router = express.Router();
var user = require('../model/user')
const getToken = require("../utils/getToken");

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});
// 登录
router.post('/login', function(req, res, next) {
  const {username, password} = req.body
  if (!username || !password) {
    res.send({
      code: 1,
      msg: '用户名或密码不能为空'
    })
    return
  }
  // 验证用户名密码
  user.findOne({username, password}, async function (err, data) {
    if (err) {
      res.send({
        code: 1,
        msg: '服务器错误'
      })
    } else {
      if (data) {
        const token = await getToken(data.username, data.password, data.role)
        // 设置cookie
        res.cookie('token', token, {
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24,
          // secure: true // 生产环境建议启用
        });
        res.send({
          code: 0,
          msg: '登录成功',
          data: {
            username: data.username,
            role: data.role
          }
        })
      } else {
        res.send({
          code: 1,
          msg: '用户名或密码错误'
        })
      }
    }
  })
});

router.get('/logout', function(req, res, next) {
  res.clearCookie('token')
  res.send({
    code: 0,
    msg: '退出成功'
  })
});

router.get('/myself', function(req, res, next) {
  // 获取token
  const token = req.cookies.token
  if (!token || JSON.stringify(token) === '{}') {
    res.send({
      code: -1,
      msg: '请先登录'
    })
    return
  }
  // 解析token
  const userObj = JSON.parse(Buffer.from(token, 'base64').toString('ascii'))
  // 查找用户
  user.findOne({username: userObj.username}, function (err, data) {
    if (err) {
      res.send({
        code: 1,
        msg: '服务器错误'
      })
    } else {
      if (data) {
        res.send({
          code: 0,
          msg: '获取用户信息成功',
          data: {
            username: data.username,
            role: data.role
          }
        })
      } else {
        res.send({
          code: 1,
          msg: '用户不存在'
        })
      }
    }
  })
})

// 修改用户
router.post('/update', function(req, res, next) {
  const {username, password, role, id} = req.body
  if (!username || !password || !role || !id) {
    res.send({
      code: 1,
      msg: '参数不能为空'
    })
    return
  }
  if (username === 'git') {
    res.send({
      code: 1,
      msg: '用户名不能为git'
    })
    return
  }
  // 判断用户名是否存在，username: username并且id不等于id
  let nameIsExist = false
  user.findOne({username, _id: {$ne: id}}, function (err, data) {
    if (err) {
      res.send({
        code: 1,
        msg: '服务器错误'
      })
    } else {
      if (data) {
        res.send({
          code: 1,
          msg: '用户名已存在'
        })
        nameIsExist = true
      }
    }
  })
  if (nameIsExist) {
    return
  }

  user.findByIdAndUpdate(id, {username, password, role}, function (err, data) {
    if (err) {
      res.send({
        code: 1,
        msg: '服务器错误'
      })
    } else {
      res.send({
        code: 0,
        msg: '修改成功'
      })
    }
  })

});

// 添加用户
router.post('/add', function(req, res, next) {
  const {username, password, role} = req.body
  if (!username || !password || !role) {
    res.send({
      code: 1,
      msg: '参数不能为空'
    })
    return
  }
  if (username === 'git') {
    res.send({
      code: 1,
      msg: '用户名不能为git'
    })
    return
  }
  user.findOne({username}, function (err, data) {
    if (err) {
      res.send({
        code: 1,
        msg: '服务器错误'
      })
    } else {
      if (data) {
        res.send({
          code: 1,
          msg: '用户名已存在'
        })
      } else {
        user.create({username, password, role}, function (err, data) {
          if (err) {
            res.send({
              code: 1,
              msg:'服务器错误'
            })
          } else {
            res.send({
              code: 0,
              msg: '添加成功'
            })
          }
        })
      }
    }
  })
});

// 用户列表
router.get('/list', function(req, res, next) {
  user.find({}, function (err, data) {
    if (err) {
      res.send({
        code: 1,
        msg: '服务器错误'
      })
    } else {
      res.send({
        code: 0,
        msg: '获取用户列表成功',
        data
      })
    }
  })
});

module.exports = router;
