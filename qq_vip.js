// 名称: QQ会员成长值签到
// 描述: 每日自动签到获取QQ会员成长值
// 作者: unknown
// 更新时间: 2025-07-07
// 支持: https://t.me/quantumultx
// 任务: 0 9 * * *

const $ = new Env("QQ会员成长值签到");
const cookieName = "QQ空间Cookie";
const cookieKey = "qq_vip_cookie";
const apiUrl = "https://act.qzone.qq.com/v2/vip/tx/trpc/subact/ExecAct";

// 从持久化存储获取Cookie
function getPersistentCookie() {
    return $.getdata(cookieKey);
}

// 计算g_tk (与Python算法一致)
function calculateGtk(cookie) {
    let pskey = cookie.match(/(?:p_skey|skey)=([^;]+)/i);
    if (!pskey || !pskey[1]) return null;
    
    pskey = pskey[1];
    let hash = 5381;
    for (let i = 0; i < pskey.length; i++) {
        hash += (hash << 5) + pskey.charCodeAt(i);
    }
    return hash & 0x7fffffff;
}

// 执行签到请求
function qqVipSign() {
    const cookie = getPersistentCookie();
    if (!cookie) {
        $.log("❌ 未找到有效的Cookie，请通过MitM获取");
        $.msg($.name, "未找到Cookie", "请访问QQ空间后重试");
        return;
    }

    const gtk = calculateGtk(cookie);
    if (!gtk) {
        $.log("❌ g_tk计算失败，请检查Cookie格式");
        $.msg($.name, "g_tk计算失败", "请更新Cookie");
        return;
    }

    const payload = {
        "SubActId": "91848_72e687bf",
        "ClientPlat": 0
    };

    const headers = {
        "Host": "act.qzone.qq.com",
        "Accept": "*/*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.1.95.613 V1_IPH_SQ_9.1.95_1_APP_A Pixel/1179 MiniAppEnable SimpleUISwitch/0 StudyMode/0 CurrentMode/0 CurrentFontScale/1.000000 QQTheme/1000 AppId/537296282",
        "Referer": "https://club.vip.qq.com/kuikly/vas_qqvip_root_page/6580",
        "Cookie": cookie
    };

    const url = `${apiUrl}?ADTAG=chouti&g_tk=${gtk}`;

    $.post({
        url: url,
        headers: headers,
        body: JSON.stringify(payload),
        timeout: 10000
    }, (error, response, data) => {
        if (error) {
            $.log(`⚠️ 请求异常: ${error}`);
            $.msg($.name, "请求失败", error);
            return;
        }

        try {
            const result = JSON.parse(data);
            if (result.Code === 0) {
                try {
                    const dataObj = JSON.parse(result.Data);
                    const reward = dataObj.op[0].packet[0].name;
                    $.log(`✅ 签到成功！获得奖励: ${reward}`);
                    $.msg($.name, "签到成功", `获得奖励: ${reward}`);
                } catch (e) {
                    $.log(`✅ 签到成功！`);
                    $.msg($.name, "签到成功", "奖励解析失败");
                }
            } else {
                const msg = result.Msg || "未知错误";
                $.log(`❌ 签到失败: ${msg}`);
                if (msg.includes("登录态") || msg.includes("未登录")) {
                    $.msg($.name, "Cookie失效", "请更新Cookie");
                } else {
                    $.msg($.name, "签到失败", msg);
                }
            }
        } catch (e) {
            $.log(`❌ 响应解析失败: ${e}`);
            $.msg($.name, "响应解析失败", "请检查日志");
        }
    });
}

// MitM获取Cookie
$.isRequest = typeof $request !== "undefined";
if ($.isRequest) {
    if ($request.url.includes("qzone.qq.com")) {
        const cookie = $request.headers["Cookie"] || $request.headers["cookie"];
        if (cookie) {
            $.setdata(cookie, cookieKey);
            $.log(`✅ 成功获取 ${cookieName}`);
            $.msg($.name, "Cookie更新成功", "请禁用此脚本");
        }
    }
    $.done();
} else {
    $.log(`\n${"=".repeat(30)}`);
    $.log(`QQ空间会员成长值签到任务开始`);
    $.log(`${"=".repeat(30)}\n`);
    qqVipSign();
}