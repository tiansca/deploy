const runDeploy = require('./deploy_work.js')
const task = {
  addTask (task) {
    // 添加任务
    if ((!global.waitQueue || !global.waitQueue.length) && !global.runWork) {
      // 直接运行
      global.runWork = task
      runDeploy(task)
    } else {
      // 添加到队列
      // 判断队列中是否有相同任务
      const index = global.waitQueue.findIndex(item => item._id === task._id)
      if (index !== -1) {
        global.waitQueue.splice(index, 1)
      }
      global.waitQueue.push(task)
    }
    global.sseClients.forEach(client => {
      task.sendTaskList(client)
    });
  },
  removeTask (id) {
    // 移除任务
    const index = global.waitQueue.findIndex(item => item._id === id)
    if (index !== -1) {
      global.waitQueue.splice(index, 1)
      global.sseClients.forEach(client => {
        task.sendTaskList(client)
      });
    }
  },
  runTask () {
    // 运行任务
    if (!global.runWork && global.waitQueue.length) {
      global.runWork = global.waitQueue.shift()
      runDeploy(global.runWork)
    } else if(global.runWork) {
      console.log('其他任务正在运行中，无法运行新的任务')
    } else {
      console.log('队列为空，无等待的任务')
    }
  },
  sendTaskList(res) {
    res.write(`data: ${JSON.stringify({
      tasks: global.waitQueue,
      activeTask: global.runWork,
      type: 'taskList'
    })}\n\n`);
  }
}

module.exports = task