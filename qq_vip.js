// 名称: QQ空间VIP签到脚本 v3.0
// 描述: 每日自动签到获取QQ会员成长值
// 作者: waron
// 更新时间: 2025-07-07
// 支持: https://t.me/quantumultx
// 任务: 0 10 * * *

const cookieName = "QQ空间VIP签到";
const cookieKey = "qq_vip_cookie";
const signurl = 'https://act.qzone.qq.com/v2/vip/tx/trpc/subact/ExecAct';
const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.1.95.613 V1_IPH_SQ_9.1.95_1_APP_A Pixel/1179 MiniAppEnable SimpleUISwitch/0 StudyMode/0 CurrentMode/0 CurrentFontScale/1.000000 QQTheme/1000 AppId/537296282";

// GTK算法
function getGTK(skey) {
    let hash = 5381;
    for (let i = 0; i < skey.length; ++i) {
        hash += (hash << 5) + skey.charCodeAt(i);
    }
    return hash & 0x7fffffff;
}

// 从Cookie中提取QQ号和skey
function extractInfo(cookie) {
    const skeyMatch = cookie.match(/p_skey=([^;]+)/) || cookie.match(/skey=([^;]+)/);
    
    if (!skeyMatch) {
        throw new Error("Cookie中未找到p_skey或skey字段");
    }
    
    return {
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
        // 提取skey
        const {skey} = extractInfo(cookie);
        const g_tk = getGTK(skey);
        console.log(`✅ 提取SKEY成功: ${skey.substring(0, 5)}...`);
        console.log(`✅ 计算GTK成功: ${g_tk}`);
        
        // 正确的签到参数（使用官方最新参数）
        const payload = {
            "SubActId": "91848_72e687bf", // 正确的签到ID
            "ClientPlat": 0
        };
        
        // 完整的请求头
        const headers = {
            "Host": "act.qzone.qq.com",
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh-Hans;q=0.9", // 必须添加的语言头
            "Content-Type": "application/json",
            "Origin": "https://act.qzone.qq.com",
            "Referer": "https://club.vip.qq.com/kuikly/vas_qqvip_root_page/6580",
            "User-Agent": ua,
            "Cookie": cookie
        };
        
        // 构建完整URL
        const fullUrl = `${signurl}?ADTAG=chouti&g_tk=${g_tk}`;
        console.log(`📤 请求URL: ${fullUrl}`);
        console.log(`📝 请求体: ${JSON.stringify(payload)}`);
        
        // 发送请求
        const startTime = Date.now();
        const response = await $task.fetch({
            url: fullUrl,
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload),
            timeout: 10 // 10秒超时
        });
        
        const duration = Date.now() - startTime;
        console.log(`⏱️ 请求耗时: ${duration}ms`);
        console.log(`📥 响应状态: ${response.statusCode}`);
        console.log(`📥 响应体: ${response.body}`);
        
        // 处理响应
        const data = JSON.parse(response.body);
        
        if (data.Code === 0) {
            try {
                // 解析奖励信息
                const dataObj = JSON.parse(data.Data);
                const reward = dataObj.op[0].packet[0].name;
                $notify(cookieName, "签到成功", `🎉 获得奖励: ${reward}`);
            } catch (e) {
                $notify(cookieName, "签到成功", "✅ 奖励解析失败");
            }
        } else if (data.Code === -4020) {
            $notify(cookieName, "成功", "✅ 今日已签到");
        } else if (data.Msg && data.Msg.includes("登录态")) {
            $notify(cookieName, "失败", "❌ Cookie已失效，请重新获取");
        } else {
            $notify(cookieName, "失败", `❌ ${data.Msg || "未知错误"}`);
        }
    } catch (error) {
        console.log(`❌ 错误详情: ${error}`);
        $notify(cookieName, "错误", `⚠️ ${error.message || error}`);
    }
    
    // 确保执行结束
    $done();
}

// 获取Cookie
function getCookie() {
    $notify(cookieName, "提示", "请访问QQ空间获取Cookie");
    $prefs.setValueForKey("", cookieKey);
    $task.openUrl("https://qzone.qq.com");
    $done();
}

// ========================= 主执行逻辑 =========================
if (typeof $request !== 'undefined') {
    // 通过重写规则触发，用于获取Cookie
    const requestUrl = $request.url;
    
    console.log(`🔍 检测到请求: ${requestUrl}`);
    
    // 只处理QQ空间相关请求
    if (requestUrl.includes("qzone.qq.com")) {
        const cookie = $request.headers["Cookie"] || $request.headers["cookie"];
        if (cookie) {
            $prefs.setValueForKey(cookie, cookieKey);
            $notify(cookieName, "成功", "✅ Cookie已更新");
            console.log("✅ 成功保存Cookie");
        } else {
            console.log("⚠️ 未找到Cookie头信息");
        }
    } else {
        console.log("⚠️ 非QQ空间请求，跳过");
    }
    
    // 结束请求
    $done({});
} else {
    // 手动执行（定时任务或手动运行）
    const cmd = typeof $argument !== "undefined" ? $argument : "sign";
    console.log(`🚀 开始执行命令: ${cmd}`);
    
    if (cmd === "getCookie") {
        getCookie();
    } else {
        sign();
    }
}
