var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var db = require('./config/db.js');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
var bodyParser = require('body-parser')
const {exec} = require("child_process");
const addAdmin = require("./utils/addAdmin");
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: false}));
// app.all('*', function (req, res, next) {
//   res.header('Access-Control-Allow-Origin', '*');
//   //Access-Control-Allow-Headers ,可根据浏览器的F12查看,把对应的粘贴在这里就行
//   res.header('Access-Control-Allow-Headers', 'Content-Type');
//   res.header('Access-Control-Allow-Methods', '*');
//   res.header('Content-Type', 'application/json;charset=utf-8');
//   next();
// });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
// app.use('/deploy', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// docker中执行copySSH.sh脚本
async function runCopySSH() {
  // 判断是否是docker容器
  if (process.env.DOCKER === 'yes') {
    // 用fs模块将copySSH.sh脚本文件内的CRLF替换为LF
    const fs = require('fs');
    const shellContent = await fs.promises.readFile('./copySSH.sh', 'utf8')
    console.log("读取copySSH.sh文件内容", shellContent)
    const newData = shellContent.replace(/\r\n/g, '\n');
    await fs.promises.writeFile('./copySSH.sh', newData, 'utf8')
    console.log("替换copySSH.sh文件内容", newData)
    const {exec} = require('child_process');
    exec('sh ./copySSH.sh', (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log('执行copySSH.sh成功');
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
    });
  }
}

runCopySSH()

// 记录当前运行的子线程任务
global.activeWorkers = {}
//等待队列和运行任务
global.waitQueue = []
global.runWork = null
// sse客户端集合
global.sseClients = new Set()
console.log(global.sseClients)

// 插入admin用户
try {
  addAdmin()
} catch (e) {
  console.log(e)
}


module.exports = app;
