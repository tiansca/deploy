var mongoose = require('mongoose');
var url ="mongodb://root:tianshicong@mongo:27017/deploy";
// var url ="mongodb://tiansc:tianshicong@localhost:27017/deploy";
mongoose.set('useCreateIndex', true)
try {
    mongoose.connect(url);
} catch (error) {
    console.log(error)
}

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
