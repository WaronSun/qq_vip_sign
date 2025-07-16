// QQ VIP会员成长值签到脚本 for Quantumult X v1.0
const cookieName = "QQ VIP成长值签到";
const cookieKey = "qq_vip_growth_cookie";
const signurl = 'https://club.vip.qq.com/api/tianxuan/execAct';
const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.1.97.606";

// GTK算法
function getGTK(skey) {
    let hash = 5381;
    for (let i = 0; i < skey.length; ++i) {
        hash += (hash << 5) + skey.charCodeAt(i);
    }
    return hash & 0x7fffffff;
}

// 从Cookie中提取关键信息
function extractInfo(cookie) {
    if (!cookie) throw new Error("Cookie为空");
    
    const qqMatch = cookie.match(/(?:p_uin|uin|o_cookie)=o?(\d+)/);
    const skeyMatch = cookie.match(/p_skey=([^;]+)/) || cookie.match(/skey=([^;]+)/);
    
    if (!qqMatch) throw new Error("未找到QQ号信息");
    if (!skeyMatch) throw new Error("未找到skey或p_skey");
    
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
        return $done();
    }
    
    try {
        // 提取QQ和skey
        const {qq, skey} = extractInfo(cookie);
        const g_tk = getGTK(skey);
        
        // 构造请求参数（根据日志中的实际请求）
        const payload = "subActId=61799_e641bcc0&actReqData=";
        
        // 发送请求
        const response = await $task.fetch({
            url: `${signurl}?g_tk=${g_tk}`,
            method: "POST",
            headers: {
                "Host": "club.vip.qq.com",
                "Accept": "*/*",
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://mq.vip.qq.com",
                "Referer": "https://mq.vip.qq.com/",
                "User-Agent": ua,
                "Cookie": cookie
            },
            body: payload
        });
        
        // 处理响应
        const data = JSON.parse(response.body);
        if (data.code === 0) {
            // 解析成长值奖励信息
            const growthValue = data.data?.op?.[0]?.packet?.[0]?.widgets?.[0]?.name || "未知成长值";
            $notify(cookieName, "签到成功", `🎉 成功领取 ${growthValue}`);
        } else {
            $notify(cookieName, "签到失败", `❌ ${data.info || "未知错误"}`);
        }
    } catch (error) {
        let errorMsg = "未知错误";
        if (error instanceof Error) {
            errorMsg = error.message;
        } else if (typeof error === 'string') {
            errorMsg = error;
        } else if (error && error.message) {
            errorMsg = error.message;
        }
        $notify(cookieName, "错误", `⚠️ ${errorMsg}`);
    }
    
    $done();
}

// 获取Cookie
function getCookie() {
    $notify(cookieName, "提示", "请访问 https://mq.vip.qq.com 获取Cookie");
    $prefs.setValueForKey("", cookieKey);
    $task.openUrl("https://mq.vip.qq.com");
    $done();
}

// ========================= 主执行逻辑 =========================
if (typeof $request !== 'undefined') {
    // 通过重写规则触发，用于获取Cookie
    const requestUrl = $request.url;
    
    // 只处理VIP相关域名
    if (requestUrl.includes("vip.qq.com")) {
        const cookie = $request.headers["Cookie"] || $request.headers["cookie"];
        if (cookie) {
            $prefs.setValueForKey(cookie, cookieKey);
            $notify(cookieName, "成功", "✅ Cookie已更新");
        }
    }
    
    $done({});
} else {
    // 手动执行（定时任务或手动运行）
    const cmd = typeof $argument !== "undefined" ? $argument : "sign";
    if (cmd === "getCookie") {
        getCookie();
    } else {
        sign();
    }
}
