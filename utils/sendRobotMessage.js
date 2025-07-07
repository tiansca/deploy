const request = require("request");

const sendRobotMessage = async (project, finished) => {
  if (!project.robotInfo || !project.robotInfo.webhook) {
    return
  }
  console.log('sendRobotMessage', project.robotInfo, project.robotInfo.webhook)
  const webhook = project.robotInfo.webhook
  // name, type, branch, tag, server
  const content = `##### 项目：${project.name}
##### 结果：${finished ? '成功' : '失败'}
##### ${project.eventType === 'push' ? '分支' : '标签'}：${project.eventType === 'push' ? project.branch : project.tagName}
##### 部署至：${project.ip || '本机'}
##### 部署路径 ${project.path}
###### 详细内容请查看日志`
  request({
    url: webhook,
    method: "POST",
    json: true,
    headers: {
      "content-type": "application/json",
    },
    body: {
      msgtype: 'markdown',
      markdown: {
        title: `${project.name}部署通知`,
        content: content,
        text: content
      }
    }
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log('推送机器人成功') // 请求成功的处理逻辑
      console.log(response.body)
    } else {
      console.log('推送机器人失败')
      if (error) {
        console.log(error)
      } else {
        console.log(response)
      }
    }
  });
}

module.exports = sendRobotMessage;