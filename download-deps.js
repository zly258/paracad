
const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置
const version = '1.0.3';
const baseUrl = `https://cdn.jsdelivr.net/npm/opencascade.js@${version}/dist/`;
const files = [
    'opencascade.full.js',
    'opencascade.full.wasm'
];

// 检测目标目录
// 如果存在 public 目录（Vite/CreateReactApp 等常见结构），则放入 public/occt
// 否则放入根目录下的 occt
const publicDir = path.join(__dirname, 'public');
const hasPublic = fs.existsSync(publicDir);
const targetDir = hasPublic ? path.join(publicDir, 'occt') : path.join(__dirname, 'occt');

// 创建目录
if (!fs.existsSync(targetDir)) {
    console.log(`创建目录: ${targetDir}`);
    fs.mkdirSync(targetDir, { recursive: true });
}

// 下载函数
const downloadFile = (fileName) => {
    const url = baseUrl + fileName;
    const destPath = path.join(targetDir, fileName);
    const file = fs.createWriteStream(destPath);

    console.log(`正在下载 ${fileName} ...`);

    https.get(url, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
            downloadFile(fileName, response.headers.location);
            return;
        }

        if (response.statusCode !== 200) {
            console.error(`下载失败 ${fileName}: HTTP ${response.statusCode}`);
            return;
        }

        response.pipe(file);

        file.on('finish', () => {
            file.close();
            console.log(`✅ 成功: ${fileName} -> ${destPath}`);
        });
    }).on('error', (err) => {
        fs.unlink(destPath, () => {}); // 删除未完成的文件
        console.error(`下载错误 ${fileName}: ${err.message}`);
    });
};

console.log(`准备下载 OpenCascade.js (v${version}) 到本地...`);
console.log(`目标路径: ${targetDir}`);
console.log('---');

files.forEach(file => downloadFile(file));
