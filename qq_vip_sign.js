// QQ空间VIP签到 - 优化版
// 最后更新：2024-06-18

// ======== 环境初始化 ========
function initEnv() {
  const env = {
    getdata: (key) => {
      if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key);
      if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key);
      return localStorage.getItem(key);
    },
    setdata: (val, key) => {
      if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(val, key);
      if (typeof $persistentStore !== 'undefined') return $persistentStore.write(val, key);
      return localStorage.setItem(key, val);
    },
    post: (options) => new Promise((resolve) => {
      if (typeof $task !== 'undefined') {
        $task.fetch(options).then(resp => resolve({
          status: resp.statusCode,
          body: resp.body,
          headers: resp.headers
        }));
      } else if (typeof $httpClient !== 'undefined') {
        $httpClient.post(options, (_, resp, body) => resolve({
          status: resp.status || resp.statusCode,
          body,
          headers: resp.headers
        }));
      }
    }),
    msg: (title, subtitle, body) => {
      if (typeof $notify !== 'undefined') $notify(title, subtitle, body);
      if (typeof $notification !== 'undefined') $notification.post(title, subtitle, body);
      console.log(`[通知] ${title} - ${subtitle}: ${body}`);
    },
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    done: () => typeof $done !== 'undefined' && $done()
  };
  return env;
}
const $ = initEnv();

// ======== 主逻辑 ========
const COOKIE_KEY = "qq_vip_cookie";

async function main() {
  try {
    const cookie = $.getdata(COOKIE_KEY);
    if (!cookie) return $.msg("❌ 错误", "未找到Cookie", "请先手动获取Cookie");

    // 执行双签到
    const results = await Promise.allSettled([
      signTask(cookie, "91848_72e687bf", "成长值签到"),
      $.wait(2000).then(() => signTask(cookie, "69778_4345371d", "活动签到"))
    ]);

    // 生成通知消息
    const messages = results.map(res => 
      res.status === 'fulfilled' ? res.value.message : `❌ ${res.reason}`
    );
    $.msg("QQ空间签到结果", "", messages.join("\n"));
    
  } catch (e) {
    $.msg("❌ 脚本异常", e.message);
  } finally {
    $.done();
  }
}

async function signTask(cookie, actId, taskName) {
  try {
    const skey = extractSkey(cookie);
    const g_tk = getGTK(skey);
    
    const response = await $.post({
      url: `https://act.qzone.qq.com/v2/vip/tx/trpc/subact/ExecAct?g_tk=${g_tk}`,
      headers: {
        "Cookie": cookie,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.1.95.613"
      },
      body: JSON.stringify({
        SubActId: actId,
        ClientPlat: 0,
        ReportInfo: { traceId: Date.now().toString(36) }
      })
    });

    // 调试输出原始响应
    console.log(`[${taskName}] 原始响应: ${response.body}`);
    
    const result = parseResponse(response.body);
    return formatResult(taskName, result);
  } catch (e) {
    throw `${taskName}请求失败: ${e.message}`;
  }
}

// ======== 关键修复函数 ========
function parseResponse(body) {
  try {
    const data = JSON.parse(body);
    
    // 增强错误码处理
    const errorCode = data.Code ?? data.retcode ?? data.code;
    const errorMsg = data.Msg ?? data.msg ?? data.message;
    
    // 处理已签到情况
    if (errorCode === -4020 || errorMsg?.includes("已签到")) {
      return { status: "already_signed" };
    }
    
    // 处理明确错误
    if (errorCode && errorCode !== 0) {
      return { 
        status: "failed", 
        msg: errorMsg || `错误码: ${errorCode}` 
      };
    }
    
    // 处理成功情况
    if (data.Data?.result === 0 || data.retcode === 0) {
      return { status: "success" };
    }
    
    // 未知响应结构
    return { status: "unknown", raw: body };
    
  } catch (e) {
    return { status: "parse_error", raw: body };
  }
}

function formatResult(taskName, result) {
  switch (result.status) {
    case "success":
      return { message: `✅ ${taskName}成功` };
    case "already_signed":
      return { message: `🔄 ${taskName}今日已签` };
    case "failed":
      return { message: `❌ ${taskName}失败: ${result.msg}` };
    case "parse_error":
      return { message: `⚠️ ${taskName}响应解析失败` };
    case "unknown":
      return { message: `⚠️ ${taskName}未知响应格式` };
    default:
      return { message: `⚠️ ${taskName}异常状态` };
  }
}

// ======== 工具函数 ========
// 优化：优先使用p_skey
function extractSkey(cookie) {
  // 先尝试匹配p_skey
  let match = cookie.match(/p_skey=([^;]+)/i);
  if (match) return match[1];
  
  // 再尝试匹配skey
  match = cookie.match(/skey=([^;]+)/i);
  if (match) return match[1];
  
  throw new Error("Cookie中缺少p_skey和skey");
}

// GTK计算函数（与您提供的算法一致）
function getGTK(skey) {
  let hash = 5381;
  for (let i = 0, len = skey.length; i < len; i++) {
    hash += (hash << 5) + skey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

// ======== 执行入口 ========
if (typeof $request !== 'undefined') {
  const cookie = $request.headers?.Cookie || $request.headers?.cookie;
  if (cookie && /qzone\.qq\.com/.test($request.url)) {
    $.setdata(cookie, COOKIE_KEY);
    $.msg("✅ Cookie获取成功", "已保存签到凭证", "");
  }
  $.done();
} else {
  main();
}
