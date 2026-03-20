import asyncio
import httpx
import json

async def test_ollama():
    url = "http://localhost:11434/api/chat"
    payload = {
        "model": "llama3.2",
        "messages": [
            {"role": "system", "content": "You are an assistant."},
            {"role": "user", "content": "hi"}
        ],
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 512}
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=60.0)
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ollama())
