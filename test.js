// const smb2 = require("smb2");
const smb2 = require("v9u-smb2");
const fs = require('fs');

// const smbClient = new smb2({
//   share: '\\\\Win-01s4eh50ngo\\c',       // 共享根目录
//   username: 'zbintel',
//   password: 'ZBintel@2020',
//   domain: '',
//   port: 445, // 默认端口
// });
let smbClient = null
function init() {
  smbClient = new smb2({
    share: '\\\\192.168.11.25\\share',       // 共享根目录
    username: 'zbintel',
    password: 'zbintel',
    domain: '',
    // port: 445, // 默认端口
  });
  return smbClient
}
init()
// const deployPath = 'Users/zbintel/Desktop/CurrVerERP0327/CurrVerERP0327/.extra_services/falcon/front-end/zb-datav'
const deployPath = 'document/front-end'
function getWindowsPath(path) {
  if (path[0] === '/') {
    // 删除
    path = path.substring(1)
  }
  return path.replace(/\//g, '\\')
}
const windowsPath = getWindowsPath(deployPath)
console.log(windowsPath)
// 转成windows路径
async function test() {
  // const res = await smbClient.readdir(windowsPath);
  const res = await smbClient.exists(windowsPath);
  console.log(res)
  if (!res) {
    await smbClient.mkdir(windowsPath);
    console.log('创建成功')
  } else {
    // 遍历文件夹下的文件，删除
    // const files = await smbClient.readdir(windowsPath, {stats: true});
    // await deleteFiles(files, smbClient, windowsPath);
    await emptyFolder(windowsPath, smbClient)
    console.log('清空成功')
  }
  // 上传本地文件夹下的所有文件
  const outputPath = 'D:\\data\\deploy\\projects\\zb-knowledge-base\\dist'
  // 遍历本地文件夹下的所有文件
  await uploadDir(outputPath, windowsPath, smbClient);
  smbClient.disconnect()
  console.log('上传成功')
}

async function uploadDir(localPath, remotePath, client) {
  client.disconnect()
  client = init()
  console.log('uploadDir', localPath)
  // 读取文件夹下的所有文件
  // return new Promise(async (resolve, reject) => {
  const files = await fs.promises.readdir(localPath);
  // console.log('files', files)
  await uploadFiles(files, remotePath, client, localPath, remotePath)
  // })
}

function uploadFiles(files, remotePath, client, localParentPath, remoteParentPath) {
  return new Promise(async (resolve, reject) => {
    console.log('uploadFiles', files)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const filePath = localParentPath + '\\' + file
        const remoteFilePath = remoteParentPath + '\\' + file
        console.log(filePath)
        // 判断file是文件夹还是文件
        const stat = await fs.promises.stat(filePath)
        // console.log('stat', stat)
        if (stat.isDirectory()) {
          await client.mkdir(remoteFilePath)
          await uploadDir(filePath, remoteFilePath, client)
        } else {
          await uploadFile(filePath, remoteFilePath, client)
        }
      }
      resolve()
    } catch ( error) {
      reject(error)
    }
  })
}

async function uploadFile(localFilePath, remoteFilePath, client) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(localFilePath);
    client.createWriteStream(remoteFilePath, (err, writeStream) => {
      if (err) return reject(err);

      readStream.pipe(writeStream)
        .on('error', reject)
        .on('finish', resolve);
    });
  });
}
async function emptyFolder(path, client) {
  // 删除文件夹下的所有文件
  try {
    const files = await client.readdir(windowsPath, {stats: true});
    await deleteFiles(files, client, windowsPath);
  } catch (error) {
    if (error.code === 'STATUS_DIRECTORY_NOT_EMPTY') {
      // 重新连接
      client.disconnect()
      client = init()
      await emptyFolder(path, client)
    } else {
      throw  error
    }
  }
}
// 遍历文件，删除
async function deleteFiles(files, client, parentPath = '') {
  return new Promise(async (resolve, reject) => {
    try {
      for (let i = 0; i < files.length; i++) {
        // 判断是文件还是文件夹
        const file = files[i]
        const filePath = parentPath + '\\' + file.name
        console.log(filePath)
        if (file.isDirectory()) {
          const subFiles = await client.readdir(filePath, {stats: true})
          console.log('subFilesLength', subFiles.length)
          if (subFiles.length > 0) {
            await deleteFiles(subFiles, client, filePath)
          }
          const confirmSub = await client.readdir(filePath)
          console.log('子文件数量：', confirmSub.length)
          console.log('删除文件夹：', filePath)
          await client.rmdir(filePath)
        } else {
          await client.unlink(filePath)
        }
      }
      resolve()
    } catch (error) {
      reject(error)
    }
  })
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
test()


// smbClient.readFile('b.txt',function(err, data){
//   if(err) throw err;
//   console.log(data.toString());       //没有指定编码格式就要用这个
//   smbClient.disconnect()
// });