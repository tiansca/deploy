/**
 * Created by administrator on 2019/10/31.
 */
var mongoose = require('mongoose');
// var url ="mongodb://root:tianshicong@localhost:27017/deploy-dev";
var url ="mongodb://root:tianshicong@localhost:27017/deploy-remote";
if (process.env.DOCKER === 'yes') {
    if (process.env.MOMGO_DOCKER === 'yes') {
        url = "mongodb://root:tianshicong@mongo:27017/deploy"; // docker容器内mongo服务
    } else {
        url ="mongodb://root:tianshicong@192.168.11.25:27017/deploy-remote"; // 主机上mongo服务
    }
}
mongoose.set('useCreateIndex', true)
mongoose.set('useFindAndModify', false)
mongoose.connect(url);
var db = mongoose.connection;
// 连接成功
db.on('open', function(){
    console.log('MongoDB Connection Successed');
});
// 连接失败
db.on('error', function(){
    console.log('MongoDB Connection Error');
});

module.exports.db = db
