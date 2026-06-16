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
