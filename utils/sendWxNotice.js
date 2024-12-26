const request = require("request");
const sendWxNotice = (project, finished) => {
  // name, type, branch, tag, server
  const content = `##### 项目：${project.name}
##### 结果：${finished ? '成功' : '失败'}
##### ${project.eventType === 'push' ? '分支' : '标签'}：${project.eventType === 'push' ? project.branch : project.tagName}
##### 部署至：${project.ip}
###### 详细内容请查看日志`
  request({
    url: 'https://xizhi.qqoq.net/XZ636e3c1c8c932063583342c1520cb70a.channel',
    method: "POST",
    json: true,
    headers: {
      "content-type": "application/json",
    },
    body: {
      title: `${project.name}部署通知`,
      content: content
    }
  }, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log('推送成功') // 请求成功的处理逻辑
    } else {
      console.log('推送失败')
      if(error) {
        console.log(error)
      } else {
        console.log(response)
      }
    }
  });
}

module.exports = sendWxNotice;