#!/usr/bin/env python3
"""
MindBody Fable Bridge — CLI Connector between Gemini (Executor) and Claude/Fable (Chief Architect).
Invokes Claude Code CLI at C:\\Users\\tgmbo\\.local\\bin\\claude.exe with prompt and returns clean UTF-8 text.
"""
import sys
import subprocess
import argparse

CLAUDE_BIN = r"C:\Users\tgmbo\.local\bin\claude.exe"

def call_fable(prompt: str, timeout: int = 240) -> str:
    system_wrapper = (
        "Ты — Главный Архитектор проекта MindBody (Fable / Claude Sonnet). "
        "Твой исполнитель — Gemini (Antigravity). Отвечай четко, по существу, профессионально.\n\n"
        + prompt
    )
    result = subprocess.run(
        [CLAUDE_BIN, "-p", "--dangerously-skip-permissions", system_wrapper],
        input="",
        text=True,
        capture_output=True,
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
    
    args = parser.parse_args()
    
    query = ""
    if args.ask:
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
        
    answer = call_fable(query)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(answer)
