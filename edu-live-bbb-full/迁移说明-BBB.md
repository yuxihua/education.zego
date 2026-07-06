# edu-live-bbb-full 迁移说明

## 已完成
- 在上一级目录创建新项目：`edu-live-bbb-full`
- 后端路由入口从 `/api/zego/*` 切换为 `/api/bbb/*`
- 新增 BBB 配置：`edu-live-server/config/bbb.js`
- 新增 BBB API 封装：`edu-live-server/utils/bbbApi.js`
- 新增 BBB 路由：`edu-live-server/routes/bbb.js`
- 更新后端环境变量模板为 BBB 配置
- 前端直播 API 增加 `getBbbReplayByRoom`，并保留旧方法兼容别名
- 前端移除 `zego-express-engine-webrtc` 依赖

## 新增后端接口
- `POST /api/bbb/meeting/:roomId/create` 创建会议
- `GET /api/bbb/join/:roomId` 生成入会链接
- `POST /api/bbb/meeting/:roomId/end` 结束会议
- `GET /api/bbb/replay/:meetingID` 查询回放

## 环境变量
在 `edu-live-server/.env` 中配置：
- `BBB_API_BASE_URL`
- `BBB_SHARED_SECRET`
- `BBB_WELCOME`
- `BBB_DEFAULT_DURATION`
- `BBB_MAX_PARTICIPANTS`
- `BBB_RECORD`
- `BBB_AUTO_START_RECORDING`
- `BBB_ALLOW_START_STOP_RECORDING`

## 注意事项
- 当前数据库字段仍沿用 `zegoRoomId` 作为会议 ID 存储字段，避免一次性改表。后续可迁移为 `bbbMeetingId`。
- 教师端/学员端页面里仍有 ZEGO 推拉流实现代码，需要在下一步替换为 BBB 入会跳转或嵌入页方案。
