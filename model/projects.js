var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var projectSchema = new Schema({
    name:String,
    url:String,
    branch: String,
    createTime:{
        type:Date,
        default:Date.now
    },
    updateTime:{
        type:Date,
        default:Date.now
    },
    status:{
        type:Boolean,
        default:true
    },
    server: String,
    path: String,
    build: String,
    localPath: String,
    outputDir: String,
    buildMode: String, // 构建模式，npm, shell
    buildShell: String, // 构建脚本
    eventType: String, // 响应git事件类型，push,tag
    tagPrefixes: String, // tag前缀，为空所有tag都响应
    startShell: String, // 启动脚本
    apiCallback: String, // api回调
    isShare: { // 是否共享，默认共享
        type: Boolean,
        default: true
    },
    owner: {
        range: {
            type: String,
            enum: ['all', 'part'], // 所有用户，部分用户
            default: 'all'
        },
        userIds: [Number],
    },
    creator: Number
}, {
    versionKey: false,
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
})

module.exports = mongoose.model('projects', projectSchema);
