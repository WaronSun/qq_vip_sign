// QQ空间VIP签到 - 全平台兼容版
// 支持 Quantumult X/Surge/Loon
// 最后更新：2023-11-15

const $ = new Env("QQ空间VIP签到");
const COOKIE_KEY = "qq_vip_cookie";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.1.95.613";

// 主函数
async function main() {
  try {
    const cookie = getValidCookie();
    if (!cookie) return;
    
    const qq = extractQQ(cookie);
    console.log(`ℹ️ 使用QQ号: ${qq}`);
    
    const results = await Promise.all([
      signTask(cookie, "91848_72e687bf", "成长值签到"),
      delay(1000).then(() => signTask(cookie, "69778_4345371d", "活动签到"))
    ]);
    
    showResult(qq, results);
  } catch (e) {
    notify("❌ 签到失败", e.message);
  }
}

// 工具函数
function getValidCookie() {
  const cookie = getData(COOKIE_KEY);
  if (!cookie) {
    notify("❌ 未找到Cookie", "请访问QQ空间网页版获取");
    return null;
  }
  return cookie;
}

async function signTask(cookie, actId, taskName) {
  try {
    const skey = extractSkey(cookie);
    const g_tk = getGTK(skey);
    
    const response = await httpPost({
      url: `https://act.qzone.qq.com/v2/vip/tx/trpc/subact/ExecAct?g_tk=${g_tk}`,
      headers: {
        "Cookie": cookie,
        "User-Agent": UA,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        SubActId: actId,
        ClientPlat: 0,
        ReportInfo: { traceId: generateTraceId() }
      })
    });
    
    return parseResult(taskName, response);
  } catch (e) {
    return { success: false, message: `❌ ${taskName}失败: ${e.message}` };
  }
}

// 平台兼容实现
function getData(key) {
  if (typeof $persistentStore !== 'undefined') {
    // Surge/Loon
    return $persistentStore.read(key);
  } else if (typeof $prefs !== 'undefined') {
    // Quantumult X
    return $prefs.valueForKey(key);
  } else if (typeof localStorage !== 'undefined') {
    // 浏览器环境
    return localStorage.getItem(key);
  }
  return null;
}

function setData(key, value) {
  if (typeof $persistentStore !== 'undefined') {
    $persistentStore.write(value, key);
  } else if (typeof $prefs !== 'undefined') {
    $prefs.setValueForKey(value, key);
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

function notify(title, subtitle = "", content = "") {
  if (typeof $notification !== 'undefined') {
    $notification.post(title, subtitle, content);
  } else if (typeof $notify !== 'undefined') {
    $notify(title, subtitle, content);
  } else {
    console.log(`[通知] ${title} - ${subtitle}: ${content}`);
  }
}

function httpPost(options) {
  return new Promise((resolve, reject) => {
    if (typeof $httpClient !== 'undefined') {
      // Surge/Loon
      $httpClient.post(options, (error, response, body) => {
        if (error) reject(error);
        else resolve({ body, headers: response.headers, status: response.status });
      });
    } else if (typeof $task !== 'undefined') {
      // Quantumult X
      $task.fetch(options).then(response => {
        resolve({
          body: response.body,
          headers: response.headers,
          status: response.statusCode
        });
      }, reject);
    } else {
      // Node.js或其他环境
      const fetch = require('node-fetch');
      fetch(options.url, {
        method: 'POST',
        headers: options.headers,
        body: options.body
      }).then(async r => {
        resolve({
          body: await r.text(),
          headers: r.headers,
          status: r.status
        });
      }).catch(reject);
    }
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 其他工具函数保持不变...
function extractSkey(cookie) {
  const match = cookie.match(/(p_skey|skey)=([^;]+)/i);
  if (!match) throw new Error("Cookie中未找到skey");
  return match[2];
}

function extractQQ(cookie) {
  const match = cookie.match(/(p_uin|uin|o_cookie)=o?(\d+)/i);
  return match?.[2] || "未知";
}

function getGTK(skey) {
  let hash = 5381;
  for (let i = 0; i < skey.length; i++) {
    hash += (hash << 5) + skey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

function generateTraceId() {
  return `${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
}

function parseResult(taskName, response) {
  if (!response.body) throw new Error("无响应内容");
  const data = JSON.parse(response.body);
  
  if (data.Code === 0) return { success: true, message: `🎉 ${taskName}成功` };
  if (data.Code === -4020) return { success: true, message: `✅ ${taskName}已签` };
  
  throw new Error(data.Msg || "未知错误");
}

function showResult(qq, results) {
  const success = results.every(r => r.success);
  const title = success ? "🎉 签到成功" : "⚠️ 签到异常";
  const messages = [`📱 QQ: ${qq}`, ...results.map(r => r.message)];
  
  notify(title, "", messages.join("\n"));
}

// 环境初始化
function Env(name) {
  return {
    name,
    getData,
    setData,
    notify,
    httpPost,
    delay
  };
}

// 执行入口
if (typeof $request !== 'undefined') {
  // 重写模式获取Cookie
  const cookie = $request.headers?.Cookie || $request.headers?.cookie;
  if (cookie && $request.url.includes('qzone.qq.com')) {
    setData(COOKIE_KEY, cookie);
    notify("✅ Cookie获取成功", "已保存签到凭证");
  }
} else {
  // 定时任务模式
  const $ = new Env("QQ空间VIP签到");
  main().finally(() => {
    if (typeof $done !== 'undefined') $done();
  });
}
