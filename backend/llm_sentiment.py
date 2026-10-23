import os
import httpx
import logging

logger = logging.getLogger(__name__)

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-3.5-turbo")

async def analyze_sentiment_llm(text: str) -> str:
    """调用大模型进行情感分析，返回 positive / neutral / negative"""
    if not LLM_API_KEY:
        logger.warning("LLM_API_KEY 未配置，默认降级为 neutral")
        return "neutral"
    
    # 强约束提示词，尽量压低延迟和幻觉
    prompt = (
        "请分析以下用户评论的情感倾向。\n"
        "要求：只输出『正面』、『中性』或『负面』这三个词语中的一个，不要输出任何标点、解释或其他文字。\n\n"
        f"评论：{text}"
    )
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LLM_BASE_URL.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
                json={
                    "model": LLM_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 10
                },
                timeout=8.0 # 设置 8 秒超时，防止阻塞评论发布
            )
            if resp.status_code == 200:
                data = resp.json()
                result = data["choices"][0]["message"]["content"].strip()
                
                # 映射回数据库需要的英文枚举
                if "正面" in result:
                    return "positive"
                elif "负面" in result:
                    return "negative"
                else:
                    return "neutral"
            else:
                logger.error(f"LLM API Error: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"调用大模型失败，使用兜底策略: {e}")
    
    return "neutral"

def get_color(sentiment: str) -> str:
    """根据情感返回对应的卡片背景色"""
    colors = {
        "positive": "#dcfce7", # 柔和绿
        "negative": "#ffe4e6", # 柔和玫瑰粉
        "neutral": "#fef3c7"   # 柔和鹅黄
    }
    return colors.get(sentiment, "#fef3c7")
