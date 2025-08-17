import os
import json
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
import threading

try:
    from dotenv import dotenv_values
except Exception:  # optional
    dotenv_values = None

import requests


def load_env():
    env = {}
    if dotenv_values is not None:
        try:
            env.update(dotenv_values('.env.local'))
        except Exception:
            pass
    # fallback to OS env
    env.setdefault('OPENAI_API_KEY', os.environ.get('OPENAI_API_KEY', ''))
    env.setdefault('OPENAI_BASE_URL', os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1'))
    env.setdefault('OPENAI_VERIFY_SSL', os.environ.get('OPENAI_VERIFY_SSL', '1'))
    return env


ENV = load_env()


SYSTEM_PROMPT = (
    "You are an AI command planner for a tiny Linux-like shell. "
    "Given a natural-language instruction, respond with a single JSON object containing a 'command' field that maps to this shell's supported commands. "
    "Supported commands: ls | open files|terminal | create <file> | read <file> | write <file> <text> | delete <file>. "
    "If the user asks to list files, return {\"command\":\"ls\"}. "
    "If unsure, pick the most reasonable command. Return only JSON."
)


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/ai':
            self.handle_ai()
        else:
            self.send_error(404, 'Not Found')

    def handle_ai(self):
        try:
            length = int(self.headers.get('content-length', '0'))
            body = self.rfile.read(length)
            payload = json.loads(body or b'{}')
            user_input = payload.get('input', '')
        except Exception as e:
            self.respond_json(400, {"error": f"bad request: {e}"})
            return
        try:
            data = self.call_ai(user_input)
            self.respond_json(200, data)
        except Exception as e:
            print(e)
            self.respond_json(500, {"error": str(e)})

    def call_ai(self, user_input: str):
        api_key = ENV.get('OPENAI_API_KEY')
        base_url = ENV.get('OPENAI_BASE_URL') or 'https://api.openai.com/v1'
        verify_ssl = ENV.get('OPENAI_VERIFY_SSL', '1') == '1'
        
        if not api_key:
            raise RuntimeError('Missing OPENAI_API_KEY')

        # OpenAI-compatible chat.completions API
        url = base_url.rstrip('/') + '/chat/completions'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
        payload = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
            ],
            "temperature": 0,
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, verify=verify_ssl, timeout=30)
            resp.raise_for_status()  # Raise error for bad status codes
            data = resp.json()
            text = data.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
            
            # Ensure JSON
            try:
                parsed = json.loads(text)
            except Exception:
                # best-effort extraction: look for a JSON object
                start = text.find('{')
                end = text.rfind('}')
                if start != -1 and end != -1 and end > start:
                    parsed = json.loads(text[start:end + 1])
                else:
                    parsed = {"command": ""}
            return {"command": parsed.get('command', '')}
            
        except requests.RequestException as e:
            raise RuntimeError(f"API request failed: {e}")

    def respond_json(self, status, obj):
        data = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def run(addr='127.0.0.1', port=8000):
    os.chdir(os.path.dirname(__file__))
    httpd = HTTPServer((addr, port), Handler)
    print(f"Serving on http://{addr}:{port}")
    httpd.serve_forever()


if __name__ == '__main__':
    run()