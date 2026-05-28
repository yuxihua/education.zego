/**
 * 支付工具封装
 * 支持：微信支付（JSAPI）、支付宝（网页/APP支付）
 */
const { Wechatpay } = require('wechatpay-node-v3');
const AlipaySdk = require('alipay-sdk').default;
const crypto = require('crypto');

// ========== 微信支付 ==========
const wxpay = new Wechatpay({
  appid: process.env.WX_APPID || '',
  mchid: process.env.WX_MCHID || '',
  privateKey: process.env.WX_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  serialNo: process.env.WX_SERIAL_NO || '',
  apiV3Key: process.env.WX_APIV3_KEY || '',
  certs: {}
});

/**
 * 创建微信支付订单（JSAPI）
 * @param {object} params - 支付参数
 * @param {string} params.description - 商品描述
 * @param {string} params.outTradeNo - 商户订单号
 * @param {number} params.amount - 金额（元）
 * @param {string} params.openid - 用户openid
 * @param {string} params.notifyUrl - 回调地址
 * @returns {Promise<object>}
 */
async function createWxOrder(params) {
  const { description, outTradeNo, amount, openid, notifyUrl } = params;
  
  const payParams = {
    description,
    out_trade_no: outTradeNo,
    notify_url: notifyUrl,
    amount: {
      total: Math.round(amount * 100) // 转为分
    },
    payer: {
      openid
    }
  };
  
  return await wxpay.transactions_jsapi(payParams);
}

/**
 * 解密微信支付回调数据
 * @param {object} body - 回调请求体
 * @returns {object}
 */
function decryptWxNotify(body) {
  return wxpay.decrypt(body, {
    aesKey: process.env.WX_APIV3_KEY,
    ciphertext: body.resource?.ciphertext,
    associatedData: body.resource?.associated_data,
    nonce: body.resource?.nonce
  });
}

/**
 * 查询微信支付订单
 * @param {string} outTradeNo - 商户订单号
 * @returns {Promise<object>}
 */
async function queryWxOrder(outTradeNo) {
  return await wxpay.query({ out_trade_no: outTradeNo });
}

/**
 * 微信退款
 * @param {object} params - 退款参数
 * @returns {Promise<object>}
 */
async function wxRefund(params) {
  const { outTradeNo, outRefundNo, amount, reason } = params;
  
  return await wxpay.refund({
    out_trade_no: outTradeNo,
    out_refund_no: outRefundNo,
    amount: {
      refund: Math.round(amount * 100),
      total: Math.round(amount * 100),
      currency: 'CNY'
    },
    reason
  });
}

// ========== 支付宝 ==========
const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APPID || '',
  privateKey: process.env.ALIPAY_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY?.replace(/\\n/g, '\n') || '',
  gateway: 'https://openapi.alipay.com/gateway.do',
  signType: 'RSA2'
});

/**
 * 创建支付宝订单（电脑网站支付）
 * @param {object} params - 支付参数
 * @param {string} params.subject - 订单标题
 * @param {string} params.outTradeNo - 商户订单号
 * @param {number} params.totalAmount - 金额（元）
 * @param {string} params.returnUrl - 支付完成跳转地址
 * @param {string} params.notifyUrl - 回调地址
 * @returns {Promise<string>} - 支付表单 HTML
 */
async function createAlipayOrder(params) {
  const { subject, outTradeNo, totalAmount, returnUrl, notifyUrl } = params;
  
  const result = await alipaySdk.exec('alipay.trade.page.pay', {
    notify_url: notifyUrl,
    return_url: returnUrl,
    bizContent: {
      subject,
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      product_code: 'FAST_INSTANT_TRADE_PAY'
    }
  });
  
  return result;
}

/**
 * 创建支付宝订单（手机网站支付）
 * @param {object} params - 支付参数
 * @returns {Promise<string>}
 */
async function createAlipayWapOrder(params) {
  const { subject, outTradeNo, totalAmount, returnUrl, notifyUrl } = params;
  
  const result = await alipaySdk.exec('alipay.trade.wap.pay', {
    notify_url: notifyUrl,
    return_url: returnUrl,
    bizContent: {
      subject,
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      product_code: 'QUICK_WAP_WAY'
    }
  });
  
  return result;
}

/**
 * 验证支付宝回调签名
 * @param {object} params - 回调参数
 * @returns {boolean}
 */
function verifyAlipayNotify(params) {
  return alipaySdk.checkNotifySign(params);
}

/**
 * 查询支付宝订单
 * @param {string} outTradeNo - 商户订单号
 * @returns {Promise<object>}
 */
async function queryAlipayOrder(outTradeNo) {
  return await alipaySdk.exec('alipay.trade.query', {
    bizContent: {
      out_trade_no: outTradeNo
    }
  });
}

/**
 * 支付宝退款
 * @param {object} params - 退款参数
 * @returns {Promise<object>}
 */
async function alipayRefund(params) {
  const { outTradeNo, refundAmount, outRequestNo, refundReason } = params;
  
  return await alipaySdk.exec('alipay.trade.refund', {
    bizContent: {
      out_trade_no: outTradeNo,
      refund_amount: refundAmount,
      out_request_no: outRequestNo,
      refund_reason: refundReason
    }
  });
}

/**
 * 生成订单号
 * @param {string} prefix - 前缀 E(微信)/A(支付宝)
 * @returns {string}
 */
function generateOrderNo(prefix = 'E') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

module.exports = {
  // 微信支付
  wxpay,
  createWxOrder,
  decryptWxNotify,
  queryWxOrder,
  wxRefund,
  
  // 支付宝
  alipaySdk,
  createAlipayOrder,
  createAlipayWapOrder,
  verifyAlipayNotify,
  queryAlipayOrder,
  alipayRefund,
  
  // 通用
  generateOrderNo
};
