#!/usr/bin/env python
"""Test LLM in Django context with local client."""
import os
import sys
import django

# Setup Django
sys.path.insert(0, r'F:\soft\vidgo\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'vid_go.settings'
django.setup()

# Now test the LLM code with local client (like the fix)
from video.views.set_setting import load_all_settings
from openai import OpenAI
import traceback

print('Django setup complete')

try:
    print('[LLM Test] Loading settings...')
    settings_data = load_all_settings()
    cfg = settings_data.get('DEFAULT', {})
    
    selected_provider = cfg.get('selected_model_provider', 'deepseek')
    print(f'[LLM Test] Selected provider: {selected_provider}')
    
    # Get provider-specific API key and base URL
    if selected_provider == 'deepseek':
        api_key = cfg.get('deepseek_api_key', '')
        base_url = cfg.get('deepseek_base_url', 'https://api.deepseek.com')
        model = 'deepseek-chat'
    elif selected_provider == 'modelscope':
        api_key = cfg.get('modelscope_api_key', '')
        base_url = cfg.get('modelscope_base_url', 'https://api-inference.modelscope.cn/v1')
        model = cfg.get('modelscope_model', 'Qwen/Qwen2.5-72B-Instruct')
    else:
        api_key = cfg.get('deepseek_api_key', '')
        base_url = cfg.get('deepseek_base_url', 'https://api.deepseek.com')
        model = 'deepseek-chat'
    
    print(f'[LLM Test] Using model: {model}, base_url: {base_url}, api_key: {"***" if api_key else "NOT SET"}')
    
    if not api_key or not base_url:
        print('[LLM Test] Error: API key or base URL not configured')
        sys.exit(1)
    
    print('[LLM Test] Creating OpenAI client locally...')
    # Create client locally - this is the fix!
    local_client = OpenAI(api_key=api_key, base_url=base_url)
    
    # Send test prompt
    prompt = 'Say hi briefly'
    print(f'[LLM Test] Sending test prompt to model {model} at {base_url}')
    response = local_client.chat.completions.create(
        model=model,
        messages=[{'role': 'user', 'content': prompt}],
        timeout=60
    )
    content = response.choices[0].message.content
    print(f'[LLM Test] Success! Response: {content}')
except Exception as exc:
    print(f'[LLM Test] Error: {exc}')
    traceback.print_exc()
