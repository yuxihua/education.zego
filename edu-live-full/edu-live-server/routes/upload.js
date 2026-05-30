/**
 * 文件上传路由
 * 支持：图片、PPT课件、视频封面等
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OSS = require('ali-oss');
const { success, fail } = require('../utils/response');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');

// 文件上传配置
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.UPLOAD_MAX_SIZE) || 100 * 1024 * 1024; // 100MB

// Multer 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(UPLOAD_DIR, req.params.type || 'images');
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'image': /jpeg|jpg|png|gif|webp/,
    'ppt': /ppt|pptx|pdf/,
    'video': /mp4|mov|avi|mkv/,
    'document': /pdf|doc|docx|xls|xlsx/
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
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter
});

// OSS 客户端
const ossClient = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
});

/**
 * @POST /api/upload/:type
 * 上传文件到本地（开发环境）
 * type: image / ppt / video / document
 */
router.post('/:type', auth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return fail(res, '未选择文件', 400, 400);
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
 * @POST /api/upload/oss/:type
 * 上传文件到阿里云 OSS（生产环境推荐）
 */
router.post('/oss/:type', auth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return fail(res, '未选择文件', 400, 400);
  }

  const { type } = req.params;
  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname);
  const ossKey = `uploads/${type}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  try {
    // 上传到 OSS
    await ossClient.put(ossKey, filePath);
    const url = `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${ossKey}`;

    success(res, {
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url,
      ossKey
    }, '上传成功');
  } catch (err) {
    console.error('[OSS上传] 失败:', err.message);
    return fail(res, '文件上传失败', 500, 500);
  }
}));

/**
 * @POST /api/upload/ppt/:roomId
 * 上传 PPT 课件（关联直播间）
 */
router.post('/ppt/:roomId', auth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return fail(res, '未选择文件', 400, 400);
  }

  const { LiveRoom, PPTFile } = require('../models');
  const { roomId } = req.params;

  const room = await LiveRoom.findByPk(roomId);
  if (!room) {
    return fail(res, '直播间不存在', 404, 404);
  }

  // 上传 PPT 到 OSS
  const ext = path.extname(req.file.originalname);
  const ossKey = `ppt/${roomId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filePath = req.file.path;

  let fileUrl = `/uploads/ppt/${req.file.filename}`;

  // 如果配置了 OSS，上传到 OSS
  if (process.env.OSS_ACCESS_KEY_ID) {
    await ossClient.put(ossKey, filePath);
    fileUrl = `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${ossKey}`;
  }

  // 保存到数据库
  const ppt = await PPTFile.create({
    roomId,
    filename: req.file.originalname,
    fileUrl,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
    status: 'ready'
  });

  success(res, ppt, 'PPT上传成功');
}));

module.exports = router;
