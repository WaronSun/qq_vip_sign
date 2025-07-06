// QQ空间VIP签到 - 错误处理增强版
const $ = new Env("QQ空间签到");
const COOKIE_KEY = "qq_vip_cookie";

async function main() {
  const cookie = $.getdata(COOKIE_KEY);
  if (!cookie) {
    $.msg("❌ 请先获取Cookie");
    return;
  }

  // 执行双签到任务
  const results = await Promise.allSettled([
    signTask(cookie, "91848_72e687bf", "成长值签到"),
    $.wait(2000).then(() => signTask(cookie, "69778_4345371d", "活动签到"))
  ]);

  // 结果处理
  const messages = results.map(res => {
    if (res.status === 'rejected') return `❌ ${res.reason}`;
    return res.value.message;
  });

  $.msg("签到结果", "", messages.join("\n"));
}

async function signTask(cookie, actId, taskName) {
  try {
    const skey = cookie.match(/(p_skey|skey)=([^;]+)/i)?.[2];
    if (!skey) throw new Error("Cookie无效");

    const g_tk = getGTK(skey);
    const response = await $.post({
      url: `https://act.qzone.qq.com/v2/vip/tx/trpc/subact/ExecAct?g_tk=${g_tk}`,
      headers: {
        "Cookie": cookie,
        "Content-Type": "application/json"
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
    throw new Error(`${taskName}失败: ${e.message}`);
  }
}

// 新版响应解析器
function parseResponse(body) {
  try {
    const data = JSON.parse(body);
    
    // 处理已知错误码
    if (data.Code === -4020 && data.Msg?.includes("用户日限制")) {
      return { code: "ALREADY_SIGNED" };
    }
    if (data.Code !== 0) {
      return { 
        code: "API_ERROR",
        msg: data.Msg || `错误码: ${data.Code}`
      };
    }
    
    // 成功情况
    return {
      code: "SUCCESS",
      data: data.Data
    };
  } catch (e) {
    return { code: "PARSE_ERROR", raw: body };
  }
}

function formatResult(taskName, result) {
  switch (result.code) {
    case "SUCCESS":
      return { 
        success: true,
        message: `✅ ${taskName}成功` 
      };
    case "ALREADY_SIGNED":
      return {
        success: true,
        message: `🟢 ${taskName}今日已签`
      };
    default:
      return {
        success: false,
        message: `❌ ${taskName}失败: ${result.msg || "未知响应格式"}`
      };
  }
}

// GTK计算（保持不变）
function getGTK(skey) {
  let hash = 5381;
  for (let i = 0; i < skey.length; i++) {
    hash += (hash << 5) + skey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}
