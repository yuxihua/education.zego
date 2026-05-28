/**
 * 文件上传路由
 * 支持：图片、PPT课件、视频等
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const typeDir = path.join(uploadDir, req.params.type || 'images');
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    cb(null, typeDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    image: /jpeg|jpg|png|gif|webp/,
    ppt: /ppt|pptx|pdf/,
    video: /mp4|mov|avi|mkv/,
    document: /pdf|doc|docx|xls|xlsx/
  };
  
  const type = req.params.type || 'image';
  const mimeType = allowedTypes[type];
  
  if (!mimeType) {
    return cb(new Error('不支持的文件类型'), false);
  }
  
  if (mimeType.test(file.mimetype) || mimeType.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error(`只允许上传 ${type} 类型文件`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter
});

/**
 * @POST /api/upload/:type
 * 通用文件上传
 * type: image / ppt / video / document
 */
router.post('/:type', auth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return fail(res, '未选择文件', 400);
  }
  
  const fileUrl = `/uploads/${req.params.type}/${req.file.filename}`;
  
  success(res, {
    originalName: req.file.originalname,
    filename: req.file.filename,
    size: req.file.size,
    mimeType: req.file.mimetype,
    url: fileUrl
  }, '上传成功');
}));

/**
 * @POST /api/upload/ppt/:roomId
 * 上传PPT课件（关联直播间）
 */
router.post('/ppt/:roomId', auth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return fail(res, '未选择文件', 400);
  }
  
  const { PPTFile, LiveRoom } = require('../models');
  const { roomId } = req.params;
  
  // 检查直播间是否存在
  const room = await LiveRoom.findByPk(roomId);
  if (!room) {
    return fail(res, '直播间不存在', 404);
  }
  
  // 保存PPT信息到数据库
  const ppt = await PPTFile.create({
    roomId,
    filename: req.file.originalname,
    fileUrl: `/uploads/ppt/${req.file.filename}`,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
    status: 'ready',
    pageCount: 1 // 实际页数需要解析PPT后更新
  });
  
  success(res, ppt, 'PPT上传成功');
}));

module.exports = router;
