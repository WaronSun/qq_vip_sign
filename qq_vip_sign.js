// QQ空间VIP双签到任务脚本
// 支持Quantumult X
// 使用说明：配置重写规则和获取Cookie脚本

const $ = new Env("QQ空间VIP双签到");
const COOKIE_KEY = "qq_vip_cookie";

// 主函数
async function main() {
  try {
    // 获取存储的Cookie
    const cookie = $.getdata(COOKIE_KEY);
    if (!cookie) {
      $.msg("❌ 未找到Cookie", "请先运行获取Cookie脚本", "");
      return;
    }

    // 提取QQ号
    const qq = extractQQ(cookie);
    $.log(`ℹ️ 使用QQ号: ${qq}`);

    // 执行签到任务
    const result = await qqVipSign(cookie);
    $.msg("QQ空间VIP签到结果", "", result.message);
    
  } catch (e) {
    $.log(`⚠️ 执行出错: ${e}`);
    $.msg("❌ QQ签到失败", "执行出错", e.message);
  } finally {
    $.done();
  }
}

// QQ空间VIP签到函数
async function qqVipSign(cookie) {
  try {
    // 计算g_tk
    const skey = extractSkey(cookie);
    const g_tk = getGTK(skey);
    
    // 执行第一个签到任务
    const result1 = await signTask(cookie, g_tk, "91848_72e687bf", "会员成长值签到");
    
    // 间隔1秒后执行第二个签到任务
    await $.wait(1000);
    const result2 = await signTask(cookie, g_tk, "69778_4345371d", "VIP活动签到");
    
    return {
      success: result1.success && result2.success,
      message: [
        `📱 QQ: ${qq}`,
        `➊ ${result1.message}`,
        `➋ ${result2.message}`
      ].join("\n")
    };
    
  } catch (e) {
    return {
      success: false,
      message: `❌ 签到失败: ${e.message}`
    };
  }
}

// 获取Cookie的脚本（独立运行）
function getCookie() {
  const cookie = $request.headers.Cookie || $request.headers.cookie;
  if (!cookie) {
    $.msg("❌ 获取Cookie失败", "请检查请求头", "");
    return;
  }
  
  // 验证是否为QQ空间的Cookie
  if (!cookie.includes("qzone.qq.com")) {
    $.msg("❌ 非QQ空间Cookie", "请访问QQ空间网页版", "");
    return;
  }
  
  $.setdata(cookie, COOKIE_KEY);
  $.msg("✅ QQ签到Cookie获取成功", "已保存到本地", "");
}

// ====================== 工具函数 ======================

// 计算g_tk
function getGTK(skey) {
  let hash = 5381;
  for (let i = 0; i < skey.length; i++) {
    hash += (hash << 5) + skey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

// 从Cookie提取skey
function extractSkey(cookie) {
  const match = cookie.match(/(?:p_skey|skey)=([^;]+)/i);
  if (!match || !match[1]) throw new Error("未找到skey");
  return match[1];
}

// 从Cookie提取QQ号
function extractQQ(cookie) {
  const match = cookie.match(/(?:p_uin|uin|o_cookie)=o?(\d+)/i);
  if (!match || !match[1]) throw new Error("未找到QQ号");
  return match[1];
}

// 执行单个签到任务
async function signTask(cookie, g_tk, actId, taskName) {
  try {
    const url = `https://act.qzone.qq.com/v2/vip/tx/trpc/subact/ExecAct?g_tk=${g_tk}`;
    const payload = {
      SubActId: actId,
      ClientPlat: 0,
      ReportInfo: JSON.stringify({
        traceId: `${Date.now()}${Math.random().toString(36).substr(2, 6)}`,
        enteranceId: "",
        traceIndex: ""
      })
    };
    
    const response = await $.post({
      url: url,
      headers: {
        "Host": "act.qzone.qq.com",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.1.95.613",
        "Referer": "https://club.vip.qq.com/",
        "Cookie": cookie
      },
      body: JSON.stringify(payload)
    });
    
    const result = JSON.parse(response.body);
    
    if (result.Code === 0) {
      return { success: true, message: "✅ 签到成功" };
    } else if (result.Code === -4020 && result.Msg.includes("用户日限制")) {
      return { success: true, message: "✅ 今日已签到" };
    } else {
      return { success: false, message: `❌ 失败: ${result.Msg || "未知错误"}` };
    }
  } catch (e) {
    return { success: false, message: `⚠️ ${taskName}异常: ${e.message}` };
  }
}

// 入口判断
if (typeof $request !== "undefined") {
  getCookie();
} else {
  main();
}

// 工具类
function Env(name) {
  this.name = name;
  this.msg = (title, subtitle, body) => $notify(title, subtitle, body);
  this.log = console.log;
  this.getdata = (key) => $persistentStore.read(key);
  this.setdata = (value, key) => $persistentStore.write(value, key);
  this.post = (options) => {
    return new Promise((resolve, reject) => {
      $httpClient.post(options, (err, resp, body) => {
        if (err) reject(err);
        else resolve(resp);
      });
    });
  };
  this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
}