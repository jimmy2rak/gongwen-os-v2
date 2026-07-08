// ─── 全局 Skill 设置面板（增强版） ──────────────
// MD/JSON 双模式编辑 + 文件上传 + 「当前使用」调节
// 存 localStorage（gw-global-skills + gw-active-global-skill-ids）

"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, FileText, Check } from "lucide-react";
import { CustomDialog } from "@/components/ui/CustomDialog";
import {
  getGlobalSkills,
  saveGlobalSkill,
  deleteGlobalSkill,
  type GlobalSkill,
} from "@/lib/global-skill-store";

const CATEGORIES = ["通用", "通知", "报告", "请示", "函", "纪要", "决定", "通报", "批复", "方案", "讲话稿", "新闻"];
const ACTIVE_KEY = "gw-active-global-skill-ids";

function uid() { return "gs" + Math.random().toString(36).slice(2, 10); }

// 当前使用的全局 Skill ID 管理
function getActiveSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { const r = localStorage.getItem(ACTIVE_KEY); return r ? new Set(JSON.parse(r)) : new Set(); } catch { return new Set(); }
}
function toggleActive(id: string) {
  try {
    const s = getActiveSet();
    if (s.has(id)) s.delete(id); else s.add(id);
    localStorage.setItem(ACTIVE_KEY, JSON.stringify([...s]));
  } catch {}
}

export default function GlobalSkillPanel() {
  const [list, setList] = useState<GlobalSkill[]>([]);
  const [editing, setEditing] = useState<GlobalSkill | null>(null);
  const [form, setForm] = useState<GlobalSkill>({ id: "", name: "", category: "通用", content: "" });
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState<"md" | "json">("md");
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const existing = getGlobalSkills();
    if (existing.length === 0) {
      // 首次加载：自动 seed 通用参考规范（内容来自公文写作指南全集）
      const seeds: GlobalSkill[] = [
        { id: uid(), name: "格式规范（GB/T 9704-2012）", category: "通用",
          content: "【页面设置】A4（210mm×297mm）。天头37mm±1mm，地脚35mm±1mm，订口28mm±1mm，翻口26mm±1mm。" +
          "【层级编号】一、（黑体）→（一）（楷体）→1.（仿宋加粗）→（1）（仿宋）→①（仿宋）。禁止跳级。" +
          "【行距】正文行距28pt（固定值），标题行距2.0倍行距，降级编号间距20pt。" +
          "【红头】红色（#c00），粗体。发文字号格式：代字+〔年份〕+序号（不编虚位）。" +
          "【版记】版记在公文末页最下端。要素间加黑色分隔线。抄送后用冒号，各单位间用逗号。印发机关和印发日期居右。" +
          "【成文日期】汉字数字（如二〇二六年七月一日），使用汉字〇（U+3007），非数字0或字母O。" +
          "【附件标注】附件：1.XXX（正文缩进），附件在落款之后、版记之前。" +
          "【引用格式】《XXX》（XX〔202X〕X号）。引用顺序：上级文件→本单位文件→相关协议/标准。多项引用之间用分号分隔。" },
        { id: uid(), name: "行文关系与语气规范", category: "通用",
          content: "【上行文（请示、报告）】语气：尊重但不卑微，陈述事实为主；禁用命令语气（应当、必须）。" +
          "称谓规范：上级机关、XXX单位。请示可标注签发人。结语：请示→以上请示妥否请批示；报告→特此报告。" +
          "铁则：一文一事、一个主送、不可越级、不可夹带（报告不可夹带请示事项）。上行文必须标注签发人姓名。请示文末注明联系人及电话。" +
          "【下行文（通知、通报、决定、批复）】指令性为主，措辞确定、态度鲜明。" +
          "称谓：各单位、各学院、各部门。结语：通知→特此通知；通报→特此通报；决定→本决定自发布之日起生效；批复→此复。" +
          "请>要>应>可>须。建议（下行文）→要求、应当。" +
          "【平行文（函）】平等协商，敬辞体系。禁用命令语气与下行文用语。" +
          "敬辞：贵单位、贵公司、贵校。对人称尊敬的XXX教授/专家。自称：我单位。" +
          "去函结语：专此函达，请予函复。复函结语：特此函告。/此复。印章必须加盖。禁用遵照执行、贯彻落实。" +
          "【纪要】第三人称客观记叙，以会议为主语。无需专用结语，主持人审定后印发。" +
          "五种会议用语：会议听取了→会议讨论了→会议认为/指出/强调→会议决定/同意/原则同意→会议要求/明确。" +
          "【讲话稿】庄重有温度，允许排比、比喻、引用。称谓按级别排序。三点法则。时令起兴。升华引用。" },
        { id: uid(), name: "用词推荐库（通用惯用/禁用/升级词表）", category: "通用",
          content: "【通用惯用词】动词：印发、开展、落实、组织、制定、成立、研究、报送、推进、完成、实现、取得、增长、提升、优化。" +
          "名词：工作、通知、单位、办法、规定、项目、管理、经费、成果、问题、措施、计划、目标。" +
          "修饰词：认真、切实、严格、及时、妥善、全面、深入。" +
          "情态词：请>要>应>可>须。" +
          "过渡词：一是二是三是、与此同时、此外、鉴于此、综上。" +
          "【通用禁用/易错词】大概、可能、也许、基本上、差不多→约/约计/范围内。OK、搞定、没问题→已完成/已就绪。如果、假如→若/如……则。应该是、可能是→经核实/经调查。按照执行→遵照执行。现在→现/现已。建议（下行文）→要求/应当。应当、必须（上行/平行文）→恳请/商请。" +
          "【动词升级】做好→抓实/落实。搞好→推进/深化。干好→落实/执行到位。抓好→统筹推进/着力推进。加强→强化/压实/夯实。收集→征集/汇集/归集。了解→掌握/摸清/摸排。完成→全面落实/按期完成。" +
          "【名词升级】问题→短板/瓶颈/痛点。想法→思路/构想/方案。方面→维度/层面/领域。效果→成效/实效/质效。任务→目标/指标/任务清单。" +
          "【短语升级】今后→下一步/后续。通过→经由/依托/借助。一起→协同/联动/共同。再次→进一步/持续/继续。为了→为/为深入贯彻落实。根据→依据/按照/依照/遵照。说明→阐释/解读/说明。四字短语推荐：创新引领、精准发力、纵深推进、融合共进、蓄势赋能、提质增效、固本强基、破局突围。" },
        { id: uid(), name: "引用与落款规范", category: "通用",
          content: "【文件引用格式】引用上级文件：《XXX》（XX〔202X〕X号）。引用本单位文件：《XXX》（本单位文种+文号）。引用会议：XXX会议（注明具体会议名称）。引用协议/合同：《XXX协议》。" +
          "引用顺序：上级文件→本单位文件→相关协议/标准。多项引用之间用分号分隔。" +
          "【会议依据引用模板】院长办公会→经院长办公会研究决定。党政联席会→经党政联席会审议通过。学术委员会→经学术委员会评审。党委会→经党委会研究同意。一般性决策→经研究，决定。" +
          "【主送机关规范】通知（普发）：各单位、各学院、各部门。通知（定向）：XXX学院/部门。请示：仅一个主送机关。报告：通常一个主送机关。函：贵单位/贵公司。批复：具体请示单位。纪要：一般无主送机关。" +
          "【发文机关署名】使用全称或规范化简称。全称示例：南京工业大学泰兴产业学院。简称在文中首次出现时标注。右对齐，不加标点。" +
          "【成文日期】汉字数字（如二〇二六年七月一日），使用汉字〇（U+3007）。位置右对齐，与发文机关同行或另起一行。" +
          "【印章】公文加盖发文机关印章，印章居中下压成文日期。纪要可通过主持人审定后印发，不一定加盖印章。函必须加盖印章。" +
          "【附件标注】附件：1.XXX（正文后落款前）。多个附件逐个标注：附件：1.XXX 2.XXX。" +
          "【抄送】下行文抄送上级机关，上行文抄送相关单位。抄送后加冒号，各单位间用逗号，最后不加标点。" +
          "【发文字号规范】发文机关代字+〔年份〕+序号。示例：泰产院发〔2026〕12号。不编虚位、不加第字。" },
        { id: uid(), name: "常见错误清单（文种/标题/引文/结语/编号）", category: "通用",
          content: "【文种混用】用请示汇报工作→报告。用报告请求批准→请示。用通知平行商洽→函。用函向下级发指令→通知。用批复答复无隶属关系单位→复函。用决定任免普通职务→通知。" +
          "【标题缺陷】缺发文机关和事由→标题三要素：发文机关+事由+文种。缺文种→标题必须有文种。标题中误用标点→标题除书名号外尽量不用标点。标题过短/过长→20-40字为宜。" +
          "【引文不规范】引用未加书名号→《XXX》。引文缺文号→《XXX》（XX〔202X〕X号）。引文顺序错误→上级→本单位→相关。会议名称不准确→写清具体会议名称。" +
          "【结语错配】通知误用此致敬礼→特此通知。报告误用妥否请批示→特此报告。请示误用特此报告→以上请示妥否请批示。去函误用特此通知→专此函达请予函复。批复误用特此通知→此复。决定缺生效条款→本决定自发布之日起生效。" +
          "【层级编号混乱】跳级编号一→1.（正确：一→（一）→1.→（1））。编号后加、和。混用中文与英文编号（全文统一）。" +
          "【附件标注错误】附件顶格→正文缩进。附件无名称→每个附件须有名称。正文未提及附件→正文中需有见附件引导。附件位置错误→附件在落款之后版记之前。" +
          "【日期格式错误】成文日期用阿拉伯数字→汉字数字。年用零不用〇→用〇（U+3007）。正文日期用汉字→正文日期使用阿拉伯数字。" },
      ];
      for (const s of seeds) {
        saveGlobalSkill(s);
      }
      setList(getGlobalSkills());
    } else {
      setList(existing);
    }
    setActiveIds(getActiveSet());
  }, []);

  const refresh = () => { setList(getGlobalSkills()); setActiveIds(getActiveSet()); };

  const openNew = () => {
    setForm({ id: uid(), name: "", category: "通用", content: "" });
    setEditing(null);
    setEditMode("md");
    setShowForm(true);
  };

  const openEdit = (s: GlobalSkill) => {
    setForm({ ...s });
    setEditing(s);
    setEditMode("md");
    setShowForm(true);
  };

  // MD ↔ JSON 转换
  const mdToJson = (md: string): string => {
    const lines = md.split("\n").filter((l) => l.trim());
    const items = lines.map((l) => l.replace(/^\d+[\.\)、\s]*/, "").replace(/^[-*]\s*/, "").trim()).filter(Boolean);
    return JSON.stringify(items, null, 2);
  };
  const jsonToMd = (jsonStr: string): string => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed.map((item, i) => `${i + 1}. ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
      if (typeof parsed === "object" && parsed !== null) {
        const rules = parsed.rules || parsed.items || [];
        if (Array.isArray(rules)) return rules.map((item: any, i: number) => `${i + 1}. ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
      }
      return jsonStr;
    } catch { return jsonStr; }
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".md")) {
      setEditMode("md"); setForm({ ...form, content: text });
    } else if (file.name.toLowerCase().endsWith(".json")) {
      setEditMode("json"); setForm({ ...form, content: text });
    } else {
      setForm({ ...form, content: `【来自 ${file.name}】${(file.size / 1024).toFixed(1)}KB，请参考原始文件编写。` });
    }
  };

  const submit = () => {
    if (!form.name.trim() || !form.content.trim()) return;
    const finalContent = editMode === "md" ? mdToJson(form.content) : form.content;
    saveGlobalSkill({ ...form, name: form.name.trim(), content: finalContent });
    refresh();
    setShowForm(false);
  };

  const remove = (id: string) => {
    setConfirmDel({ id });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800">全局写作 Skill</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            与「公文类型 Skill」(DocSkill) 并存，二者会一起注入 AI 提示词
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
          <Plus className="w-3.5 h-3.5" /> 新建 Skill
        </button>
      </div>

      {list.length === 0 && !showForm && (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-xs text-gray-400">尚未配置全局 Skill，点击右上角新建</p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {list.map((s) => {
          const isActive = activeIds.has(s.id);
          return (
            <div key={s.id} className={`p-3 rounded-xl border ${isActive ? "border-[#163f3a]/20 bg-[#163f3a]/5" : "border-gray-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {/* 当前使用 checkbox */}
                    <button
                      onClick={() => { toggleActive(s.id); refresh(); }}
                      title={isActive ? "取消当前" : "设为当前使用的 Skill"}
                      className={`flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0 ${
                        isActive ? "bg-[#163f3a] border-[#163f3a] text-white" : "border-gray-300 hover:border-[#163f3a]/40"
                      }`}
                    >
                      {isActive && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </button>
                    <span className="text-sm font-medium text-gray-800 truncate">{s.name}</span>
                    <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{s.category}</span>
                    {isActive && (
                      <span className="text-[9px] text-white bg-[#163f3a] px-1.5 py-0.5 rounded">当前</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{s.content}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(s)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    <Pencil className="w-3 h-3" /> 编辑
                  </button>
                  <button onClick={() => remove(s.id)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-600 bg-red-50 rounded hover:bg-red-100">
                    <Trash2 className="w-3 h-3" /> 删除
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">{editing ? "编辑 Skill" : "新建 Skill"}</h4>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-gray-500">名称 *</span>
              <input value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：公文语气规范"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">分类</span>
              <select value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300">
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </label>
          </div>

          {/* 编辑模式 + 上传 */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditMode("md"); setForm({ ...form, content: jsonToMd(form.content) }); }}
                className={`px-3 py-1 text-[11px] rounded transition-colors ${editMode === "md" ? "bg-[#163f3a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                MD 纯文本
              </button>
              <button onClick={() => { setEditMode("json"); setForm({ ...form, content: mdToJson(form.content) }); }}
                className={`px-3 py-1 text-[11px] rounded transition-colors ${editMode === "json" ? "bg-[#163f3a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                JSON 编辑
              </button>
            </div>
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 bg-white border border-gray-200 rounded cursor-pointer hover:bg-gray-100">
                <FileText className="w-3 h-3" /> 上传文件
                <input type="file" accept=".md,.json,.docx" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
              </label>
              <button title="需配置 API 密钥"
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-amber-700 bg-amber-50 rounded hover:bg-amber-100">
                ✨ AI 解析
              </button>
            </div>
          </div>

          {editMode === "md" ? (
            <label className="block mt-3">
              <span className="text-xs text-gray-500">
                Markdown 格式（每行一条规则，自动编号）
                <button onClick={() => setForm({ ...form, content: "1. 正文一律使用第三人称客观表述\n2. 政策表述需与现行法规一致\n3. 避免情绪化语言和主观臆断" })}
                  className="ml-2 text-[#163f3a] hover:underline text-[10px]">插入示例</button>
              </span>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4}
                placeholder="1. 正文一律使用第三人称客观表述&#10;2. 政策表述需与现行法规一致&#10;3. ..."
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-red-300" />
            </label>
          ) : (
            <label className="block mt-3">
              <span className="text-xs text-gray-500">JSON 格式（字符串数组或 &#123;rules: [...]&#125; 对象）</span>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4}
                placeholder='["正文一律使用第三人称客观表述","政策表述需与现行法规一致"]'
                className="mt-1 w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-red-300" />
            </label>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              取消
            </button>
            <button onClick={submit}
              disabled={!form.name.trim() || !form.content.trim()}
              className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300">
              保存
            </button>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <CustomDialog
        open={!!confirmDel}
        mode="confirm"
        title="删除 Skill"
        message="确定删除该 Skill？删除后无法恢复。"
        confirmText="确定删除"
        cancelText="取消"
        onConfirm={() => {
          if (confirmDel) {
            deleteGlobalSkill(confirmDel.id);
            refresh();
            setConfirmDel(null);
          }
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
