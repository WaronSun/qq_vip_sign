// QQ空间VIP签到 - 兼容Quantumult X完整版
// 最后更新：2023-11-20

// ======== 环境初始化 ========
function initEnv() {
  const env = {
    name: "QQ空间签到",
    // 存储操作
    getdata: (key) => {
      if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key); // QX
      if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key); // Surge/Loon
      return localStorage.getItem(key); // 浏览器环境
    },
    setdata: (val, key) => {
      if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(val, key);
      if (typeof $persistentStore !== 'undefined') return $persistentStore.write(val, key);
      return localStorage.setItem(key, val);
    },
    // 网络请求
    post: (options) => new Promise((resolve) => {
      if (typeof $task !== 'undefined') { // QX
        $task.fetch(options).then(resp => resolve({
          status: resp.statusCode,
          body: resp.body,
          headers: resp.headers
        }));
      } else if (typeof $httpClient !== 'undefined') { // Surge/Loon
        $httpClient.post(options, (_, resp, body) => resolve({
          status: resp.status || resp.statusCode,
          body,
          headers: resp.headers
        }));
      }
    }),
    // 工具方法
    msg: (title, subtitle, body) => {
      if (typeof $notify !== 'undefined') $notify(title, subtitle, body); // QX
      if (typeof $notification !== 'undefined') $notification.post(title, subtitle, body); // Surge/Loon
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
    $.msg("签到结果", "", messages.join("\n"));
    
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
        ReportInfo: { traceId: Date.now().toString() }
      })
    });

    const result = parseResponse(response.body);
    return formatResult(taskName, result);
  } catch (e) {
    throw `${taskName}请求失败: ${e.message}`;
  }
}

// ======== 工具函数 ========
function extractSkey(cookie) {
  const match = cookie.match(/(p_skey|skey)=([^;]+)/i);
  if (!match) throw new Error("Cookie中缺少skey");
  return match[2];
}

function getGTK(skey) {
  let hash = 5381;
  for (let i = 0; i < skey.length; i++) {
    hash += (hash << 5) + skey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

function parseResponse(body) {
  try {
    const data = JSON.parse(body);
    if (data.Code === -4020 && data.Msg?.includes("用户日限制")) {
      return { status: "already_signed" };
    }
    if (data.Code !== 0) {
      return { status: "failed", msg: data.Msg || `错误码: ${data.Code}` };
    }
    return { status: "success", data: data.Data };
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
    default:
      return { message: `⚠️ ${taskName}异常: 响应格式错误` };
  }
}

// ======== 执行入口 ========
if (typeof $request !== 'undefined') {
  // 重写模式获取Cookie
  const cookie = $request.headers?.Cookie || $request.headers?.cookie;
  if (cookie && /qzone\.qq\.com/.test($request.url)) {
    $.setdata(cookie, COOKIE_KEY);
    $.msg("✅ Cookie获取成功", "已保存签到凭证", "");
  }
  $.done();
} else {
  // 定时任务模式
  main();
}
