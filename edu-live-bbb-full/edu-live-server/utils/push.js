/**
 * 消息推送统一封装
 * 支持：微信小程序订阅消息、APP 推送（极光/个推）
 */
const request = require('request-promise-native');

const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';

// ========== 微信 AccessToken 管理 ==========
let wxAccessToken = '';
let wxTokenExpire = 0;

/**
 * 获取微信 AccessToken（带缓存）
 * @returns {Promise<string>}
 */
async function getWxAccessToken() {
  if (wxAccessToken && Date.now() < wxTokenExpire) {
    return wxAccessToken;
  }
  
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_SECRET}`;
  const res = await request({ url, json: true });
  
  if (!res.access_token) {
    throw new Error(`获取 AccessToken 失败: ${res.errmsg || '未知错误'}`);
  }
  
  wxAccessToken = res.access_token;
  // 提前5分钟过期
  wxTokenExpire = Date.now() + (res.expires_in - 300) * 1000;
  return wxAccessToken;
}

// ========== 微信小程序订阅消息 ==========

/**
 * 发送微信小程序订阅消息
 * @param {object} params
 * @param {string} params.openid - 用户 openid
 * @param {string} params.templateId - 模板 ID
 * @param {string} params.page - 跳转页面路径
 * @param {object} params.data - 模板数据
 * @returns {Promise<object>}
 */
async function sendWxSubscribeMessage(params) {
  try {
    const { openid, templateId, page, data } = params;
    const token = await getWxAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`;
    
    const body = {
      touser: openid,
      template_id: templateId,
      page,
      data
    };
    
    const res = await request({
      url,
      method: 'POST',
      body,
      json: true
    });
    
    if (res.errcode !== 0) {
      console.error('[微信订阅消息] 发送失败:', res);
      return { success: false, error: res };
    }
    
    console.log(`[微信订阅消息] 发送成功: ${openid}`);
    return { success: true, msgid: res.msgid };
  } catch (err) {
    console.error('[微信订阅消息] 发送异常:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 直播开始提醒
 * @param {string} openid - 用户 openid
 * @param {string} liveTitle - 直播标题/课程名称
 * @param {string} startTime - 开播时间（格式：2024年01月01日 12:00）
 * @param {string} page - 跳转页面
 * @returns {Promise<object>}
 */
async function notifyLiveStart(openid, liveTitle, startTime, page) {
  return sendWxSubscribeMessage({
    openid,
    templateId: '你的直播开始提醒模板ID', // 在微信公众平台申请
    page,
    data: {
      thing1: { value: liveTitle },      // 课程名称
      time2: { value: startTime },        // 开播时间
      thing3: { value: '点击进入直播间' }  // 温馨提示
    }
  });
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

/**
 * 作业批改通知
 * @param {string} openid - 用户 openid
 * @param {string} courseName - 课程名称
 * @param {string} homeworkTitle - 作业标题
 * @param {number} score - 得分
 * @param {string} page - 跳转页面
 * @returns {Promise<object>}
 */
async function notifyHomeworkGraded(openid, courseName, homeworkTitle, score, page) {
  return sendWxSubscribeMessage({
    openid,
    templateId: '你的作业批改通知模板ID',
    page,
    data: {
      thing1: { value: courseName },          // 课程名称
      thing2: { value: homeworkTitle },       // 作业标题
      character_string3: { value: `${score}分` } // 得分
    }
  });
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

/**
 * APP 推送（接入极光推送 JPush）
 * @param {object} params
 * @param {string} params.userId - 用户 ID（极光 Registration ID）
 * @param {string} params.title - 推送标题
 * @param {string} params.content - 推送内容
 * @param {object} params.extras - 附加参数
 * @returns {Promise<object>}
 */
async function sendAppPush(params) {
  const { userId, title, content, extras = {} } = params;
  
  try {
    // TODO: 接入极光推送 JPush SDK
    // 示例：
    // const JPush = require('jpush-sdk');
    // const client = JPush.buildClient(
    //   process.env.JPUSH_APPKEY,
    //   process.env.JPUSH_SECRET
    // );
    // client.push().setPlatform(JPush.ALL)
    //   .setAudience(JPush.registration_id(userId))
    //   .setNotification(title, JPush.ios(content, 'sound', 1), JPush.android(content, title, 1, extras))
    //   .send();
    
    console.log(`[APP推送] 用户:${userId} 标题:${title} 内容:${content}`);
    return { success: true };
  } catch (err) {
    console.error('[APP推送] 发送失败:', err.message);
    return { success: false, error: err.message };
  }
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
