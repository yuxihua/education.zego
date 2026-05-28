#!/bin/bash
# ==========================================
# 修复 ZEGO 白板 PPT 上传功能
# ==========================================

set -e

cd /var/www/education.zego/edu-live-admin

echo "=== 修复 LivePush.vue ==="

python3 << 'PYTHON'
with open('src/views/teacher/LivePush.vue', 'r') as f:
    content = f.read()

# 1. 添加 axios 导入（如果还没有）
if 'import axios' not in content:
    content = content.replace(
        "import { getLiveRoomDetail, stopLive } from '@/api/live'",
        "import { getLiveRoomDetail, stopLive } from '@/api/live'\nimport axios from 'axios'"
    )
    print("✓ 添加 axios 导入")

# 2. 替换 uploadPPT 函数
start = content.find('const uploadPPT = async () => {')
if start >= 0:
    # 找到函数结束
    brace_count = 0
    end = start
    for i in range(start, len(content)):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end = i + 1
                break
    
    new_upload = """const uploadPPT = async () => {
  if (!zegoSuperBoard.value) {
    ElMessage.warning('白板未初始化，请等待直播开始')
    return
  }
  
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.ppt,.pptx,.pdf'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    ElMessage.info('PPT 上传中，请稍候...')
    try {
      const uploadResult = await zegoSuperBoard.value.uploadFile(file, {
        fileName: file.name,
        fileType: file.name.toLowerCase().endsWith('.pdf') ? 512 : 256
      })
      
      console.log('PPT上传结果:', uploadResult)
      
      const fileViewResult = await zegoSuperBoard.value.createFileView({
        fileID: uploadResult.fileID,
        name: file.name
      })
      
      console.log('PPT视图创建:', fileViewResult)
      
      currentSuperBoardView.value = fileViewResult.fileView
      totalPage.value = fileViewResult.fileView.getPageCount() || 1
      currentPage.value = 1
      
      ElMessage.success(`PPT "${file.name}" 加载成功，共 ${totalPage.value} 页`)
    } catch (err) {
      console.error('PPT上传/加载失败:', err)
      ElMessage.error('PPT 加载失败: ' + (err.message || '未知错误'))
    }
  }
  input.click()
}"""
    
    content = content[:start] + new_upload + content[end:]
    print("✓ uploadPPT 已替换")
else:
    print("✗ uploadPPT 未找到")

# 3. 替换 initWhiteboard 函数
old_init = """const initWhiteboard = async (roomID, token, userID) => {
  await loadSuperBoardSDK();
  const ZegoSuperBoardManager = window.ZegoSuperBoardManager;
  zegoSuperBoard.value = ZegoSuperBoardManager.getInstance()
  
  await zegoSuperBoard.value.init(zg.value, {
    parentDom: whiteboardRef.value,
    appID: ZEGO_CONFIG.appID,
    token: token,
    roomID: roomID,
    userID: userID,
    userName: roomInfo.value.teacherName
  })

  const result = await zegoSuperBoard.value.createWhiteboardView({
    name: '课件白板', perPageWidth: 1600, perPageHeight: 900, pageCount: 5
  })

  currentSuperBoardView.value = result.whiteboardView
  totalPage.value = result.whiteboardView.getPageCount()
  
  currentSuperBoardView.value.on('scrollChange', (data) => {
    currentPage.value = data.currentPage
  })
}"""

new_init = """const initWhiteboard = async (roomID, token, userID) => {
  try {
    await loadSuperBoardSDK()
    const ZegoSuperBoardManager = window.ZegoSuperBoardManager
    
    if (!ZegoSuperBoardManager) {
      throw new Error('SuperBoard SDK 加载失败')
    }
    
    zegoSuperBoard.value = ZegoSuperBoardManager.getInstance()
    
    await zegoSuperBoard.value.init(zg.value, {
      parentDom: whiteboardRef.value,
      appID: ZEGO_CONFIG.appID,
      token: token,
      roomID: roomID,
      userID: userID,
      userName: roomInfo.value.teacherName || '讲师'
    })

    const result = await zegoSuperBoard.value.createWhiteboardView({
      name: '课件白板',
      perPageWidth: 1600,
      perPageHeight: 900,
      pageCount: 5
    })

    if (result && result.whiteboardView) {
      currentSuperBoardView.value = result.whiteboardView
      totalPage.value = result.whiteboardView.getPageCount() || 5
      
      currentSuperBoardView.value.on('scrollChange', (data) => {
        currentPage.value = data.currentPage || 1
      })
      
      console.log('白板初始化成功，页数:', totalPage.value)
    }
  } catch (err) {
    console.error('白板初始化失败:', err)
    ElMessage.warning('白板加载失败: ' + (err.message || '未知错误'))
  }
}"""

if old_init in content:
    content = content.replace(old_init, new_init)
    print("✓ initWhiteboard 已替换")
else:
    print("✗ initWhiteboard 未找到")

with open('src/views/teacher/LivePush.vue', 'w') as f:
    f.write(content)

print("=== 文件已保存 ===")
PYTHON

echo ""
echo "=== 构建前端 ==="
npm run build

echo ""
echo "=== 完成 ==="
echo "刷新页面后测试 PPT 上传"
