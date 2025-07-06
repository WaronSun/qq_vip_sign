// QQ空间VIP签到脚本 for Quantumult X
// 配置步骤：
// 1. 添加重写规则和MITM
// 2. 添加定时任务
// 3. 访问QQ空间获取Cookie

const cookieName = "QQ空间VIP签到";
const cookieKey = "qq_vip_cookie";
const signurl = 'https://act.qzone.qq.com/v2/vip/tx/trpc/subact/ExecAct';
const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.1.95.613";

// GTK算法（与Python版本一致）
function getGTK(skey) {
    let hash = 5381;
    for (let i = 0; i < skey.length; ++i) {
        hash += (hash << 5) + skey.charCodeAt(i);
    }
    return hash & 0x7fffffff;
}

// 从Cookie中提取QQ号和skey
function extractInfo(cookie) {
    const qqMatch = cookie.match(/(?:p_uin|uin|o_cookie)=o?(\d+)/);
    const skeyMatch = cookie.match(/p_skey=([^;]+)/) || cookie.match(/skey=([^;]+)/);
    
    if (!qqMatch || !skeyMatch) {
        throw new Error("Cookie格式错误");
    }
    
    return {
        qq: qqMatch[1],
        skey: skeyMatch[1]
    };
}

// 主签到函数
async function sign() {
    const cookie = $prefs.valueForKey(cookieKey);
    if (!cookie) {
        $notify(cookieName, "失败", "⚠️ 请先获取Cookie");
        return;
    }
    
    try {
        // 提取QQ和skey
        const {qq, skey} = extractInfo(cookie);
        const g_tk = getGTK(skey);
        
        // 构造请求参数
        const traceId = `${qq}${Math.floor(Date.now()/1000)}${Math.floor(Math.random()*9000+1000)}`;
        const payload = {
            "g_tk": g_tk,
            "ActReqData": "{}",
            "IsSso": false,
            "SubActId": "69778_4345371d",
            "ReportInfo": JSON.stringify({
                "enteranceId": "",
                "traceIndex": Math.random().toString(36).substring(2, 18),
                "traceId": traceId
            })
        };
        
        // 发送请求
        const response = await $task.fetch({
            url: `${signurl}?g_tk=${g_tk}`,
            method: "POST",
            headers: {
                "Host": "act.qzone.qq.com",
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "Origin": "https://act.qzone.qq.com",
                "Referer": "https://act.qzone.qq.com/v2/vip/tx/p/42420_8c19f989",
                "User-Agent": ua,
                "Cookie": cookie
            },
            body: JSON.stringify(payload)
        });
        
        // 处理响应
        const data = JSON.parse(response.body);
        if (data.Code === 0) {
            $notify(cookieName, "成功", "🎉 签到成功！");
        } else if (data.Code === -4020 && data.Msg && data.Msg.includes("用户日限制")) {
            $notify(cookieName, "成功", "✅ 今日已签到");
        } else {
            $notify(cookieName, "失败", `❌ ${data.Msg || "未知错误"}`);
        }
    } catch (error) {
        $notify(cookieName, "错误", `⚠️ ${error.message || error}`);
    }
}

// 获取Cookie
function getCookie() {
    $notify(cookieName, "提示", "请访问QQ空间获取Cookie");
    $prefs.setValueForKey("", cookieKey);
    $task.openUrl("https://qzone.qq.com");
}

// ========================= 主执行逻辑 =========================
if ($request) {
    // 通过重写规则触发，用于获取Cookie
    const requestUrl = $request.url;
    if (requestUrl.includes("qzone.qq.com") || requestUrl.includes("qq.com")) {
        const cookie = $request.headers["Cookie"] || $request.headers["cookie"];
        if (cookie) {
            $prefs.setValueForKey(cookie, cookieKey);
            $notify(cookieName, "成功", "✅ Cookie已更新");
        }
    }
} else {
    // 手动执行（定时任务或手动运行）
    const cmd = typeof $argument !== "undefined" ? $argument : "sign";
    if (cmd === "getCookie") {
        getCookie();
    } else {
        sign();
    }
}
