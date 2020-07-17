/**
 * Created by administrator on 2019/10/31.
 */
var mongoose = require('mongoose');
// var url ="mongodb://root:tianshicong@localhost:27017/memo";
var url ="mongodb://root:tianshicong@localhost:27017/deploy-local";
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
