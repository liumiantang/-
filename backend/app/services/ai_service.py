"""AI service — OpenAI-compatible API calls for question generation and explanation."""
from __future__ import annotations
from typing import Optional
import json
import re
from openai import OpenAI
from .. import ai_config
from .. import ai_usage


def _get_client() -> Optional[OpenAI]:
    cfg = ai_config.load_config()
    if not cfg.get("api_key"):
        return None
    return OpenAI(api_key=cfg["api_key"], base_url=cfg["api_base"])


def _chat(system: str, user: str, temperature: float = 0.7) -> tuple[Optional[str], dict]:
    """Returns (content, usage_dict). usage_dict has prompt_tokens, completion_tokens, total_tokens."""
    client = _get_client()
    if not client:
        return None, {}
    cfg = ai_config.load_config()
    resp = client.chat.completions.create(
        model=cfg["model"],
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        timeout=120,
    )
    content = resp.choices[0].message.content
    usage = {}
    if resp.usage:
        usage = {
            "prompt_tokens": resp.usage.prompt_tokens,
            "completion_tokens": resp.usage.completion_tokens,
            "total_tokens": resp.usage.total_tokens,
        }
    return content, usage


TYPE_LABELS = {
    "single_choice": "单选题",
    "multi_choice": "多选题",
    "true_false": "判断题",
    "fill_blank": "填空题",
    "essay": "简答题",
}

GENERATE_SYSTEM = """你是一个专业的出题老师。根据用户提供的内容生成高质量题目。

你必须严格按照以下 JSON 格式返回，不要有任何其他文字：

{
  "questions": [
    {
      "type": "single_choice",
      "difficulty": 3,
      "tags": ["标签1"],
      "content": "题目内容",
      "options": {"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"},
      "answer": "A",
      "explanation": "解析说明"
    }
  ]
}

规则：
- type 只能取: single_choice, multi_choice, true_false, fill_blank
- difficulty 1-5，1最简单5最难
- 单选题 options 必须有4个选项{A,B,C,D}，answer 为单个字母
- 多选题 options 至少4个{A,B,C,D}，answer 为多个字母如 "ABD"
- 判断题 answer 填"正确"或"错误"
- 填空题 answer 为正确答案文本
- explanation 简明扼要，控制在100字以内
- 只返回JSON，不要任何其他文字"""


def generate_questions(text: str, count: int = 5, types: Optional[list[str]] = None, difficulty: int = 3) -> list[dict]:
    """Generate questions from text. Returns list of question dicts."""
    if types is None:
        types = ["single_choice"]

    type_labels = [TYPE_LABELS.get(t, t) for t in types]
    user_prompt = f"""请根据以下内容生成 {count} 道题目。

内容：
---
{text}
---

要求：
- 题型：{'、'.join(type_labels)}
- 默认难度：{difficulty}/5
- 保证题目质量，选项要有迷惑性"""

    raw, usage = _chat(GENERATE_SYSTEM, user_prompt, temperature=0.8)
    if not raw:
        return []
    cfg = ai_config.load_config()
    ai_usage.log_usage("generate", cfg["provider"], cfg["model"],
                       usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))

    # Extract JSON from response (handle markdown code blocks)
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if not json_match:
        return []

    try:
        data = json.loads(json_match.group(0))
        return data.get("questions", [])
    except json.JSONDecodeError:
        return []


EXPLAIN_SYSTEM = """你是一个专业的题目解析老师。对用户提供的题目进行深度解析。

要求：
1. 解释正确答案为什么对
2. 如果有选项，分析错误选项为什么错
3. 总结相关知识点
4. 控制在200字以内
5. 直接给出解析，不要格式化标记"""


def explain_question(content: str, options: Optional[dict], answer: str, q_type: str) -> Optional[str]:
    """Generate deep explanation for a question."""
    opts_text = ""
    if options:
        opts_text = "\n".join([f"{k}. {v}" for k, v in options.items()])

    nl = "\n"
    user_prompt = f"""题目类型：{TYPE_LABELS.get(q_type, q_type)}
题目内容：{content}
{f"选项：{nl}{opts_text}" if opts_text else ""}
正确答案：{answer}

请对这道题进行深度解析。"""

    content, usage = _chat(EXPLAIN_SYSTEM, user_prompt, temperature=0.5)
    if content and usage:
        cfg = ai_config.load_config()
        ai_usage.log_usage("explain", cfg["provider"], cfg["model"],
                           usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))
    return content


GRADE_SYSTEM = """你是一位严格公正的阅卷老师。请根据参考答案对学生的作答进行评分。

评分规则：
1. 满分为100分
2. 对照参考答案的关键要点进行评分
3. 考虑以下维度：
   - 要点完整性：是否覆盖所有关键知识点（60分）
   - 表述准确性：专业术语使用是否正确（20分）
   - 逻辑清晰度：论述是否有条理，结构是否合理（20分）
4. 允许学生用自己的话表达，不要求逐字匹配
5. 如果学生答案完全偏离主题或空白，可给0-10分

你必须严格按照以下 JSON 格式返回，不要有任何其他文字：
{
  "score": 85,
  "feedback": "得分点：...\\n不足之处：..."
}

feedback 要求：
- 先说明得分点和亮点
- 再指出不足和遗漏
- 控制在200字以内
- 语气客观、有建设性"""


def grade_essay(question_content: str, reference_answer: str, user_answer: str) -> tuple[Optional[float], Optional[str]]:
    """Grade an essay answer using AI. Returns (score: 0-100, feedback)."""
    user_prompt = f"""请对以下简答题进行评分：

题目：
{question_content}

参考答案：
{reference_answer}

学生答案：
{user_answer}"""

    raw, usage = _chat(GRADE_SYSTEM, user_prompt, temperature=0.3)
    if not raw:
        return None, None

    cfg = ai_config.load_config()
    ai_usage.log_usage("grade", cfg["provider"], cfg["model"],
                       usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))

    # Extract JSON from response
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if not json_match:
        return None, None

    try:
        data = json.loads(json_match.group(0))
        score = float(data.get("score", 0))
        feedback = data.get("feedback", "")
        # Clamp score to 0-100
        score = max(0.0, min(100.0, score))
        return score, feedback
    except (json.JSONDecodeError, ValueError, TypeError):
        return None, None


PARSE_EXAM_SYSTEM = """你是一个专业的试题解析器。请从以下文本中提取所有题目，返回结构化 JSON。

文本可能来自 PDF 扫描 OCR，含有少量识别错误。你需要根据上下文理解并纠正。

你必须严格按照以下 JSON 格式返回，不要有任何其他文字：

{
  "questions": [
    {
      "type": "single_choice",
      "difficulty": 3,
      "content": "题目内容（修正OCR错误后的完整表述）",
      "options": {"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"},
      "answer": "A",
      "explanation": "解析说明（如原文有）"
    }
  ]
}

规则：
- type 取值: single_choice(单选), multi_choice(多选), true_false(判断), fill_blank(填空), essay(简答)
- 单选题: options 最多{A,B,C,D,E}，answer 为正确选项字母
- 多选题: options 至少4个，answer 如"ABD"（字母顺序、无空格）
- 判断题: options 为{"A":"正确","B":"错误"}，answer 为"正确"或"错误"
- 填空题: 无需 options，answer 为正确答案文本
- 简答题: 无需 options，answer 为参考答案文本
- 如果原文没有答案信息，answer 留空字符串
- 如果原文有解析/说明文字，填到 explanation
- difficulty 默认为 3，除非题目中有标注难度
- 不要编造题目，只提取原文中存在的题目
- 只返回 JSON"""


def parse_exam_text(text: str) -> list[dict]:
    """Parse raw exam text into structured questions using AI.

    Splits long text into chunks for faster processing.
    Returns list of question dicts with keys: type, difficulty, content,
    options, answer, explanation.
    """
    # Trim excessive whitespace to reduce token usage
    text = re.sub(r'\n{3,}', '\n\n', text.strip())
    text = re.sub(r'[ \t]{3,}', '  ', text)

    MAX_CHARS = 8000
    if len(text) > MAX_CHARS:
        # Truncate to keep processing fast — take first + last portion
        text = text[:MAX_CHARS - 2000] + '\n\n...\n\n' + text[-2000:]

    # Split into ~4000 char chunks for faster AI processing
    CHUNK_SIZE = 4000
    chunks = []
    if len(text) <= CHUNK_SIZE:
        chunks = [text]
    else:
        # Split on paragraph boundaries
        paragraphs = text.split('\n\n')
        current = ''
        for p in paragraphs:
            if len(current) + len(p) + 2 > CHUNK_SIZE and current:
                chunks.append(current)
                current = p
            else:
                current = (current + '\n\n' + p).strip()
        if current:
            chunks.append(current)

    all_questions = []
    cfg = ai_config.load_config()

    for i, chunk in enumerate(chunks):
        chunk_label = f" (段落 {i + 1}/{len(chunks)})" if len(chunks) > 1 else ""
        print(f"[AI Parse] Processing chunk {i + 1}/{len(chunks)} ({len(chunk)} chars)...", flush=True)

        user_prompt = f"请解析以下试题文本{chunk_label}：\n\n{chunk}"

        raw, usage = _chat(PARSE_EXAM_SYSTEM, user_prompt, temperature=0.2)
        if not raw:
            print(f"[AI Parse] Chunk {i + 1} returned empty response", flush=True)
            continue

        ai_usage.log_usage("parse_exam", cfg["provider"], cfg["model"],
                           usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))

        json_match = re.search(r'\{[\s\S]*\}', raw)
        if not json_match:
            print(f"[AI Parse] Chunk {i + 1}: no JSON found in response", flush=True)
            continue

        try:
            data = json.loads(json_match.group(0))
            questions = data.get("questions", [])
            all_questions.extend(questions)
            print(f"[AI Parse] Chunk {i + 1}: extracted {len(questions)} questions", flush=True)
        except json.JSONDecodeError as e:
            print(f"[AI Parse] Chunk {i + 1}: JSON parse error: {e}", flush=True)
            continue

    print(f"[AI Parse] Total: {len(all_questions)} questions", flush=True)
    return all_questions


def test_connection() -> dict:
    """Test AI API connection. Returns success/error dict."""
    client = _get_client()
    if not client:
        return {"ok": False, "error": "API Key 未配置"}

    try:
        cfg = ai_config.load_config()
        resp = client.chat.completions.create(
            model=cfg["model"],
            messages=[{"role": "user", "content": "你好，请回复'连接成功'"}],
            temperature=0,
            max_tokens=20,
            timeout=30,
        )
        reply = resp.choices[0].message.content
        usage_out = {}
        if resp.usage:
            usage_out = {"prompt_tokens": resp.usage.prompt_tokens,
                         "completion_tokens": resp.usage.completion_tokens,
                         "total_tokens": resp.usage.total_tokens}
            ai_usage.log_usage("test", cfg["provider"], cfg["model"],
                               resp.usage.prompt_tokens, resp.usage.completion_tokens)
        return {"ok": True, "reply": reply, "usage": usage_out}
    except Exception as e:
        return {"ok": False, "error": str(e)}
