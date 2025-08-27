const getToken = (username, password, role) => {
  return new Promise(async (resolve, reject) => {
    if (!username || !password) {
      return reject('用户名或密码错误')
    }
    try {
      const user = {
        username,
        password,
        role
      }
      const token = Buffer.from(JSON.stringify(user)).toString('base64')
      resolve(token)
    } catch (e) {
      return reject(e)
    }
  })
}
module.exports = getToken