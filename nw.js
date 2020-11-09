const name = '106自动部署';//项目名称
let Service = require('node-windows').Service;
let EventLogger = require('node-windows').EventLogger;
let log = new EventLogger(name);
let svc = new Service({
    name,//服务名称
    description: 'vue-scscms',
    script: require('path').join(__dirname,'bin/www'),//要执行的node文件
    wait: 2,//程序重启的时间间隔
    grow: .5, //程序重启的时间增长值
    maxRetries: 40 //60秒内最大重启次数
});

svc.on('install',function(){
    svc.start();
    log.info('install complete.');
});

svc.on('uninstall',function(){
    log.info('Uninstall complete.');
    log.warn('The service exists: ',svc.exists);
});

svc.on('alreadyinstalled',()=>{
    log.error('This service is already installed.');
});

if(svc.exists) return svc.uninstall();

svc.install();
