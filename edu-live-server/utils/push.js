
const axios = require('axios')

const WX_APPID = process.env.WX_APPID || ''
const WX_SECRET = process.env.WX_SECRET || ''

// 获取微信 AccessToken
let wxAccessToken = ''
let wxTokenExpire = 0

async function getWxAccessToken() {
  if (wxAccessToken && Date.now() < wxTokenExpire) {
    return wxAccessToken
  }
  
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_SECRET}`
  const { data } = await axios.get(url)
  
  wxAccessToken = data.access_token
  wxTokenExpire = Date.now() + (data.expires_in - 300) * 1000
  return wxAccessToken
}

// ========== 微信小程序订阅消息 ==========
async function sendWxSubscribeMessage({ openid, templateId, page, data }) {
  try {
    const token = await getWxAccessToken()
    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`
    
    const body = {
      touser: openid,
      template_id: templateId,
      page,
      data
    }
    
    const { data: res } = await axios.post(url, body)
    
    if (res.errcode !== 0) {
      console.error('微信订阅消息发送失败:', res)
    }
    return res
  } catch (err) {
    console.error('发送微信订阅消息异常:', err.message)
  }
}
// 直播开始提醒模板
async function notifyLiveStart(openid, liveTitle, startTime, page) {
  return sendWxSubscribeMessage({
    openid,
    templateId: '你的直播开始提醒模板ID',
    page,
    data: {
      thing1: { value: liveTitle },
      time2: { value: startTime },
      thing3: { value: '点击进入直播间' }
    }
  })
}

/**
 * 课程购买成功通知
 * @param {string} openid - 用户 openid
 * @param {string} courseName - 课程名称
 * @param {string} orderNo - 订单号
 * @param {string} payTime - 支付时间
 * @param {string} page - 跳转页面
 * @returns {Promise<object>}
 */
async function notifyPurchaseSuccess(openid, courseName, orderNo, payTime, page) {
  return sendWxSubscribeMessage({
    openid,
    templateId: '你的购买成功通知模板ID',
    page,
    data: {
      thing1: { value: courseName },      // 商品名称
      character_string2: { value: orderNo }, // 订单编号
      time3: { value: payTime },          // 支付时间
      phrase4: { value: '支付成功' }       // 支付状态
    }
  });
}

// 作业批改通知模板
async function notifyHomeworkGraded(openid, courseName, homeworkTitle, score, page) {
  return sendWxSubscribeMessage({
    openid,
    templateId: '你的作业批改通知模板ID',
    page,
    data: {
      thing1: { value: courseName },
      thing2: { value: homeworkTitle },
      character_string3: { value: score + '分' }
    }
  })
}

/**
 * 直播预约提醒
 * @param {string} openid - 用户 openid
 * @param {string} teacherName - 讲师姓名
 * @param {string} liveTitle - 直播标题
 * @param {string} liveTime - 直播时间
 * @param {string} page - 跳转页面
 * @returns {Promise<object>}
 */
async function notifyLiveReservation(openid, teacherName, liveTitle, liveTime, page) {
  return sendWxSubscribeMessage({
    openid,
    templateId: '你的直播预约提醒模板ID',
    page,
    data: {
      name1: { value: teacherName },     // 讲师
      thing2: { value: liveTitle },       // 直播主题
      time3: { value: liveTime },         // 开播时间
      thing4: { value: '点击准时观看' }    // 温馨提示
    }
  });
}

// ========== APP 厂商推送 ==========
async function sendAppPush({ userId, title, content, extras = {} }) {
  console.log(`[APP推送] 用户:${userId} 标题:${title} 内容:${content}`)
  return { success: true }
}

module.exports = {
  sendWxSubscribeMessage,
  notifyLiveStart,
  notifyHomeworkGraded,
  sendAppPush
}

/**
 * 批量推送（直播开始通知所有预约用户）
 * @param {Array<string>} openids - openid 列表
 * @param {string} liveTitle - 直播标题
 * @param {string} startTime - 开播时间
 * @param {string} page - 跳转页面
 * @returns {Promise<object>}
 */
async function batchNotifyLiveStart(openids, liveTitle, startTime, page) {
  const results = {
    total: openids.length,
    success: 0,
    failed: 0,
    errors: []
  };
  
  // 批量发送，控制并发
  const batchSize = 10;
  for (let i = 0; i < openids.length; i += batchSize) {
    const batch = openids.slice(i, i + batchSize);
    const promises = batch.map(openid => 
      notifyLiveStart(openid, liveTitle, startTime, page)
        .then(res => {
          if (res.success) results.success++;
          else {
            results.failed++;
            results.errors.push({ openid, error: res.error });
          }
        })
        .catch(err => {
          results.failed++;
          results.errors.push({ openid, error: err.message });
        })
    );
    
    await Promise.all(promises);
    // 间隔 100ms 避免触发频率限制
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`[批量推送] 总计:${results.total} 成功:${results.success} 失败:${results.failed}`);
  return results;
}

module.exports = {
  // 微信订阅消息
  sendWxSubscribeMessage,
  notifyLiveStart,
  notifyPurchaseSuccess,
  notifyHomeworkGraded,
  notifyLiveReservation,
  getWxAccessToken,
  
  // APP 推送
  sendAppPush,
  
  // 批量推送
  batchNotifyLiveStart
};
