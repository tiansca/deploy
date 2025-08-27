const user = require('../model/user')
// 添加默认用户
function addAdmin() {
  const admin = {
    username: 'admin',
    password: 'admin@123',
    role: 'admin'
  }
  user.findOne({username: admin.username}, function (err, data) {
    if (err) {
      console.log('服务器错误')
    } else {
      if (!data) {
        user.create(admin, function (err, data) {
          if (err) {
            console.log('服务器错误')
          } else {
            console.log('添加默认用户成功')
          }
        })
      } else {
        console.log('默认用户已经存在')
      }
    }
  })
}
module.exports = addAdmin