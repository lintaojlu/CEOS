// AI 日报整理模块：通过本地代理调用火山引擎 LLM，自动整理当日工作日报。

(() => {
    // 代理地址：后端接收 POST { prompt }，用 API Key 调火山引擎，返回 { text: "..." }。
    const AI_EVAL_PROXY_URL = "http://localhost:2233/api/ai-eval";

    function $(id) {
        return document.getElementById(id);
    }

    function renderMarkdown(text) {
        if (!text) return "";
        if (typeof marked !== "undefined" && marked.parse) {
            try { return marked.parse(text, { gfm: true }); } catch (e) { return escapeHtml(text).replace(/\n/g, "<br>"); }
        }
        return escapeHtml(text).replace(/\n/g, "<br>");
    }
    function escapeHtml(s) {
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
    }

    function getCurrentDayData() {
        if (!window.app || typeof app.getCurrentData !== "function") {
            return {
                required: [],
                optional: [],
                ideas: [],
                reflection: "",
                reflectionTags: []
            };
        }
        try {
            const data = app.getCurrentData();
            const reflectionTextarea = $("dailyReflection");
            return {
                required: data.required || [],
                optional: data.optional || [],
                ideas: data.ideas || [],
                reflection: reflectionTextarea ? reflectionTextarea.value : (data.reflection || ""),
                reflectionTags: Array.isArray(data.reflectionTags) ? data.reflectionTags : (data.reflectionTag ? [data.reflectionTag] : [])
            };
        } catch {
            return {
                required: [],
                optional: [],
                ideas: [],
                reflection: "",
                reflectionTags: []
            };
        }
    }

    function formatTasks(list) {
        if (!list || list.length === 0) return "（无）";
        return list
            .map((t) => {
                const status = t.completed ? "已完成" : "未完成";
                let timeStr = "";
                if (t.time) {
                    const d = new Date(t.time);
                    if (!isNaN(d.getTime())) {
                        timeStr = d.toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false
                        });
                    }
                }
                const note = t.note ? `（${t.note}）` : "";
                const timePart = timeStr ? ` @ ${timeStr}` : "";
                const content = t.text || t.title || "";
                return `- [${status}] ${content}${timePart}${note}`;
            })
            .join("\n");
    }

    // 仅保留「已完成」任务，且不包含时间与完成状态，用于直接给 AI 作为进展输入（用于日报）
    function formatDoneTasks(list) {
        if (!list || list.length === 0) return "（今日暂无已完成任务）";
        const done = list.filter(t => t && t.completed);
        if (!done.length) return "（今日暂无已完成任务）";
        return done
            .map(t => {
                const content = t.text || t.title || "";
                const note = t.note ? `（${t.note}）` : "";
                return `- ${content}${note}`;
            })
            .join("\n");
    }

    function buildPrompt() {
        const data = getCurrentDayData();
        const date = (window.app && app.currentDate) ? app.currentDate : new Date();
        const dateStr = date.toISOString().split("T")[0];
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const mdStr = `${month}.${day}`;
        const progressLabelEl = $("progressLabel");
        const progressText = progressLabelEl ? progressLabelEl.textContent.trim() : "";

        return [
            "你是一位擅长帮助 CEO 整理业务进展与投融资进展的高级助理，请用简洁、结构化的中文，把下面的信息整理成一篇可直接发送给团队的《AI吊坠BU 日报》。",
            "",
            "【期望输出格式示例（仅供格式参考，不要使用其中任何内容）】",
            `AI吊坠BU ${mdStr} 日报`,
            "左侧",
            "- 团队开年拉通会，完成时间线和工作重点的梳理",
            "- 卡片已完成首版，软硬件预计3.3落地，AWE期间线上同步发售",
            "- 推进AI吊坠ID设计，软件和算法正在自研，预计 2 周可出demo",
            "- 推进渠道规划，全年营销计划制定，产品商标事项跟进",
            "- 推进抖音直播间相关事项落地，已联系、确定机构，预计 3.1 号落地",
            "- 推进团队组建，推进 3 人入职，品牌公关、HRBP、新媒体运营",
            "右侧",
            "- 筹备与@高卉妍一同前往南通募资，预计 3.3 号出发",
            "- 杭州、柳州、武汉基金建联中，递交BP",
            "【写作要求】",
            "1. 只输出日报正文，不要解释你的操作，也不要添加额外的小节或问候语。",
            "2. 标题第一行必须为：AI吊坠BU " + mdStr + " 日报（日期用当前日期的「月.日」格式）。",
            "3. 标题后空一行，输出一行“左侧”，下面用若干条以“- ”开头的项目符号，分别概括业务进展（来源：已完成的任务 + 相关灵感/感悟）。",
            "4. 再空一行，输出一行“右侧”，下面用若干条以“- ”开头的项目符号，分别概括投融资 / 募资方面的进展；若没有，则只输出一条“- 暂无进展”。",
            "5. 左侧代表业务侧进展，右侧代表投融资 / 募资相关进展。",
            "6. 只把“已完成”的任务整理成一条一条的进展描述；未完成的任务只作为你理解的参考，不要写进进展里。",
            "7. 每一条进展都要像日报那样具体，包含行动与结果，并尽可能带有量化的结果（数量、金额、比例、人数等）或明确的预期时间（如“预计 3.3 上线”、“2 周内完成”）。",
            "8. 左侧列表中的最后一条推荐是“团队组建 / 招聘相关”的进展；将面试、招聘、入职等进展归类到这一条中",
            "9. 投融资 / 募资如果没有进展，请在右侧输出一条“- 暂无进展”。",
            "",
            "【输入数据】（供你理解、提炼、整理）",
            `日期（ISO）：${dateStr}`,
            "",
            "已完成的必做任务：",
            formatDoneTasks(data.required),
            "",
            "已完成的选做任务：",
            formatDoneTasks(data.optional),
            "",
            "灵感 / 想法：",
            formatDoneTasks(data.ideas),
            "",
            "每日感悟原文（可用于提炼进展和语气）：",
            data.reflection || "（今日暂未填写感悟）"
        ].join("\n");
    }

    // 构造用于生成《CEO 的反思》的 Prompt
    function buildReflectionPrompt() {
        const data = getCurrentDayData();
        const date = (window.app && app.currentDate) ? app.currentDate : new Date();
        const dateStr = date.toISOString().split("T")[0];
        const progressLabelEl = $("progressLabel");
        const progressText = progressLabelEl ? progressLabelEl.textContent.trim() : "";

        return [
            "你是一位长期辅导创业者做复盘与自我觉察的教练，现在请根据下面的信息，帮这位 CEO 写一篇当日的总结与自我反思。",
            "这篇文章的标题必须固定为：《CEO的反思》。",
            "",
            `日期：${dateStr}`,
            (data.reflectionTags && data.reflectionTags.length) ? `今日标签：${data.reflectionTags.join("、")}` : "",
            progressText ? `任务完成情况概览：${progressText}` : "",
            "",
            "今日所有必做任务：",
            formatTasks(data.required),
            "",
            "今日所有选做任务：",
            formatTasks(data.optional),
            "",
            "今日所有灵感 / 想法：",
            formatTasks(data.ideas),
            "【写作要求】",
            "1. 标题使用单独一行：《CEO的反思》。",
            "2. 全文保持精简，整体控制在 200-400 字之间，不要啰嗦。",
            "3. 开头用 1-2 句话整体回顾今天：主要精力花在哪里、整体状态如何。",
            "4. 中间用 2-4 条短句（可用无序列表），分别写【做得好的地方】和【可以改进的地方】，每条都要结合具体任务或事实。",
            "5. 结尾用 1 段写【明天的一个小承诺】，给出 1-3 个具体可执行的小行动，语言直接、务实。"
        ].join("\n");
    }

    async function callViaProxy(prompt) {
        const res = await fetch(AI_EVAL_PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`代理返回 ${res.status}: ${text}`);
        }
        const data = await res.json();
        if (data && typeof data.text === "string") return data.text.trim();
        if (data && typeof data.content === "string") return data.content.trim();
        throw new Error("代理返回格式需为 { text: \"...\" }");
    }

    async function callVolcengineLLM(prompt) {
        if (!AI_EVAL_PROXY_URL) {
            throw new Error("请在 js/ai-eval.js 中配置 AI_EVAL_PROXY_URL 为你的后端地址。");
        }
        return callViaProxy(prompt);
    }

    async function evaluateToday() {
        const statusEl = $("aiEvalStatus");
        const resultEl = $("aiEvalResult");
        const btnEl = $("aiEvaluateBtn");

        if (!statusEl || !resultEl) return;

        const originalBtnText = btnEl ? btnEl.textContent : "";

        try {
            if (btnEl) {
                btnEl.disabled = true;
                btnEl.textContent = "生成中...";
                btnEl.classList.add("opacity-70", "cursor-not-allowed");
            }
            statusEl.textContent = "AI 正在根据今天的任务与感悟生成固定格式的工作日报，请稍候...";
            resultEl.innerHTML = "";

            const prompt = buildPrompt();
            // 调用前打印 prompt，便于调试
            console.log("[AI 日报] 发送 Prompt:", prompt);

            const answer = await callVolcengineLLM(prompt);

            // 调用后打印 answer，便于调试
            console.log("[AI 日报] 接收 Answer:", answer);

            // 将原始 Markdown 挂在到 DOM 节点上，作为“日报内容”的唯一来源
            if (resultEl) {
                resultEl.dataset.markdown = answer || "";
                resultEl.innerHTML = renderMarkdown(answer);
            }

            if (window.app && typeof app.setCurrentDayAiEval === "function") app.setCurrentDayAiEval(answer);
            statusEl.textContent = "生成完成。你可以直接复制这份日报，发送给团队或保存归档。";
        } catch (err) {
            console.error(err);
                statusEl.textContent = err && err.message
                ? `调用失败：${err.message}`
                : "调用 AI 日报生成失败，请稍后重试。";
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = originalBtnText || "生成今日日报";
                btnEl.classList.remove("opacity-70", "cursor-not-allowed");
            }
        }
    }

    // 生成《CEO 的反思》
    async function generateReflection() {
        const statusEl = $("aiReflectionStatus");
        const btnEl = $("aiReflectionBtn");

        const hasDisplay = $("dailyReflectionDisplay");

        const originalBtnText = btnEl ? btnEl.textContent : "";

        try {
            if (btnEl) {
                btnEl.disabled = true;
                btnEl.textContent = "生成中...";
                btnEl.classList.add("opacity-70", "cursor-not-allowed");
            }
            if (statusEl) {
                statusEl.textContent = "AI 正在根据今日任务与记录生成《CEO的反思》，请稍候...";
            }

            const prompt = buildReflectionPrompt();
            console.log("[AI 反思] 发送 Prompt:", prompt);

            const answer = await callVolcengineLLM(prompt);
            console.log("[AI 反思] 接收 Answer:", answer);

            // 将结果写入当前日期的数据，并用现有渲染逻辑展示
            if (window.app && typeof app.getCurrentData === "function" && typeof app.saveData === "function" && typeof app.renderReflection === "function") {
                const data = app.getCurrentData();
                data.reflection = answer || "";
                app.saveData();
                app.renderReflection();
            } else if (hasDisplay) {
                hasDisplay.innerHTML = renderMarkdown(answer || "");
            }

            if (statusEl) {
                statusEl.textContent = "已生成《CEO的反思》，你可以直接使用或继续微调。";
            }
        } catch (err) {
            console.error(err);
            if (statusEl) {
                statusEl.textContent = err && err.message
                    ? `AI 反思生成失败：${err.message}`
                    : "AI 反思生成失败，请稍后重试。";
            }
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = originalBtnText || "生成AI反思";
                btnEl.classList.remove("opacity-70", "cursor-not-allowed");
            }
        }
    }

    // 复制当前生成的日报到剪贴板（直接读取 DOM 上存的原始 Markdown）
    async function copyTodayReport() {
        const resultEl = $("aiEvalResult");
        if (!resultEl) return;

        // 优先从 DOM data 属性中读取原始 Markdown
        let textToCopy = "";
        if (resultEl.dataset && typeof resultEl.dataset.markdown === "string") {
            textToCopy = resultEl.dataset.markdown.trim();
        }

        // 如果 data-markdown 不存在（例如老数据），再退回到纯文本
        if (!textToCopy) {
            textToCopy = (resultEl.innerText || resultEl.textContent || "").trim();
        }

        if (!textToCopy) {
            alert("当前没有可复制的日报内容，请先生成今日日报。");
            return;
        }

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                // 兼容性降级方案
                const textarea = document.createElement("textarea");
                textarea.value = textToCopy;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            console.log("[AI 日报] 已复制到剪贴板");

            const statusEl = $("aiEvalStatus");
            if (statusEl) {
                const oldText = statusEl.textContent;
                statusEl.textContent = "已复制到剪贴板，可直接粘贴发送。";
                setTimeout(() => {
                    // 如果期间没有被其他操作改写，再恢复
                    if (statusEl.textContent === "已复制到剪贴板，可直接粘贴发送。") {
                        statusEl.textContent = oldText;
                    }
                }, 2000);
            }
        } catch (e) {
            console.error("[AI 日报] 复制失败:", e);
            alert("复制失败，请手动选择文本复制。");
        }
    }

    // 对外暴露一个简单的全局对象，供 HTML 中 onclick 调用
    window.aiEval = {
        evaluateToday,
        copyTodayReport,
        generateReflection
    };
})();

