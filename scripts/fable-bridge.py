#!/usr/bin/env python3
"""
MindBody Fable Bridge — CLI Connector between Gemini (Executor) and Claude/Fable (Chief Architect).
Invokes Claude Code CLI at C:\\Users\\tgmbo\\.local\\bin\\claude.exe with prompt and returns clean UTF-8 text.
"""
import sys
import subprocess
import argparse

CLAUDE_BIN = r"C:\Users\tgmbo\.local\bin\claude.exe"

def call_fable(prompt: str, timeout: int = 600, effort: str = "high") -> str:
    system_wrapper = (
        "Ты — Главный Архитектор проекта MindBody (Fable / Claude Sonnet). "
        "Твой исполнитель — Gemini (Antigravity). Отвечай четко, по существу, профессионально.\n\n"
        + prompt
    )
    cmd = [CLAUDE_BIN, "--effort", effort, "-p", system_wrapper, "--dangerously-skip-permissions"]
    result = subprocess.run(
        cmd,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout
    )
    if result.returncode != 0 and result.stderr:
        sys.stderr.write(f"Claude CLI Error: {result.stderr}\n")
    return result.stdout.strip()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Call Claude/Fable from Gemini")
    parser.add_argument("prompt", nargs="*", help="Prompt to send to Fable")
    parser.add_argument("--ask", help="Ask Fable a strategic question")
    parser.add_argument("--report", help="Report task completion to Fable for audit")
    parser.add_argument("--file", help="Path to UTF-8 file containing prompt")
    parser.add_argument("--effort", default="max", choices=["low", "medium", "high", "xhigh", "max"], help="Effort/thinking level for Claude")
    parser.add_argument("--timeout", type=int, default=600, help="Timeout in seconds")
    
    args = parser.parse_args()
    
    query = ""
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            query = f.read().strip()
    elif args.ask:
        query = f"ВОПРОС АРХИТЕКТОРУ ОТ ИСПОЛНИТЕЛЯ (Gemini):\n{args.ask}"
    elif args.report:
        query = f"ОТЧЕТ ИСПОЛНИТЕЛЯ (Gemini) НА ПРИЁМКУ АРХИТЕКТОРУ:\n{args.report}"
    elif args.prompt:
        query = " ".join(args.prompt)
    else:
        query = sys.stdin.read().strip()
        
    if not query:
        print("Usage: python scripts/fable-bridge.py \"prompt\" or --ask \"...\" or --report \"...\"")
        sys.exit(1)
        
    answer = call_fable(query, timeout=args.timeout, effort=args.effort)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(answer)
