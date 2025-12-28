#!/usr/bin/env python
"""Test OpenAI SDK with Deepseek API."""
import openai
print(f'OpenAI version: {openai.__version__}')

from openai import OpenAI

# Test with Deepseek
client = OpenAI(
    api_key='sk-17047f89de904759a241f4086bd5a9bf',
    base_url='https://api.deepseek.com'
)

print('Client created successfully')
print('Sending test request...')

try:
    response = client.chat.completions.create(
        model='deepseek-chat',
        messages=[{'role': 'user', 'content': 'Say hi in one word'}],
        timeout=30
    )
    print(f'Response: {response.choices[0].message.content}')
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
