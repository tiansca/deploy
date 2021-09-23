var mongoose = require('mongoose');
// var url ="mongodb://root:tianshicong@localhost:27017/deploy-online";
var url ="mongodb://tiansc:tianshicong@localhost:27017/deploy";
mongoose.set('useCreateIndex', true)
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
