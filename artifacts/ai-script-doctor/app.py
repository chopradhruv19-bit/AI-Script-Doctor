import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Callable

from flask import Flask, jsonify, request, send_from_directory
from google import genai
from google.genai import types


ROOT = Path(__file__).resolve().parent
DIST_DIR = ROOT / "dist" / "public"
MODEL = "gemini-2.5-flash"
FALLBACK_MODEL = "gemini-3.6-flash"
REQUEST_TIMEOUT_MS = 120_000

app = Flask(__name__, static_folder=str(DIST_DIR), static_url_path="")


def get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
    )


def clean_json(text: str) -> dict[str, Any]:
    """Parse model JSON while tolerating a fenced response."""
    value = text.strip()
    if value.startswith("```"):
        value = value.removeprefix("```json").removeprefix("```").strip()
        value = value.removesuffix("```").strip()
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("Gemini returned a non-object JSON response.")
    return parsed


def generate_json(client: genai.Client, prompt: str, temperature: float) -> str:
    config = types.GenerateContentConfig(
        temperature=temperature,
        response_mime_type="application/json",
    )
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=config,
        )
    except Exception as error:  # noqa: BLE001 - provider-specific retirement error has no stable public type
        if "no longer available to new users" not in str(error):
            raise
        app.logger.warning("Requested Gemini model unavailable; using current provider fallback.")
        response = client.models.generate_content(
            model=FALLBACK_MODEL,
            contents=prompt,
            config=config,
        )
    if not response.text:
        raise ValueError("Gemini returned an empty response.")
    return response.text


def run_agent(role: str, script: str, instructions: str) -> dict[str, Any]:
    client = get_client()
    prompt = f"""You are the {role} on a professional screenplay development team.
Read the screenplay below closely. Be specific, constructive, and grounded in the
actual pages. Never invent scenes or characters. Return ONLY valid JSON matching
the requested shape. Do not wrap it in markdown fences.

{instructions}

SCREENPLAY:
---
{script}
---
"""
    try:
        return clean_json(generate_json(client, prompt, 0.2))
    except ValueError as error:
        if "empty response" in str(error):
            raise ValueError(f"{role} returned an empty response.") from error
        raise


def structure_agent(script: str) -> dict[str, Any]:
    return run_agent(
        "structure and pacing analyst",
        script,
        """Return this exact top-level shape:
{
  "overall_assessment": "string",
  "acts": [
    {"act": "Act I", "summary": "string", "pages_or_scenes": "string", "pacing": "string", "issues": ["string"]}
  ],
  "pacing_issues": [{"location": "string", "issue": "string", "why_it_matters": "string", "suggestion": "string"}],
  "turning_points": [{"location": "string", "event": "string", "strength": "string"}]
}
Identify the three-act shape even when the draft is unconventional, and use scene
numbers or page references when they are visible.""",
    )


def character_consistency_agent(script: str) -> dict[str, Any]:
    return run_agent(
        "character voice and consistency analyst",
        script,
        """Return this exact top-level shape:
{
  "overall_assessment": "string",
  "characters": [
    {"name": "string", "voice_profile": "string", "strengths": ["string"], "inconsistencies": [{"location": "string", "issue": "string", "evidence": "string", "suggestion": "string"}]}
  ],
  "relationship_notes": ["string"],
  "highest_priority_flags": ["string"]
}
Flag only meaningful moments where a character acts, speaks, knows something, or
changes motivation in a way that conflicts with the draft's established voice or
behavior. Distinguish intentional development from accidental inconsistency.""",
    )


def dialogue_quality_agent(script: str) -> dict[str, Any]:
    return run_agent(
        "dialogue quality analyst",
        script,
        """Return this exact top-level shape:
{
  "overall_assessment": "string",
  "naturalness_score": 1,
  "score_rationale": "string",
  "on_the_nose_lines": [{"location": "string", "speaker": "string", "line": "string", "why_it_is_on_the_nose": "string", "subtext_direction": "string"}],
  "dialogue_strengths": ["string"],
  "dialogue_patterns_to_watch": ["string"]
}
Score naturalness from 1 (stilted or expositional) to 10 (distinctive, layered,
and effortless). Quote short lines only when useful, and preserve the draft's
intent rather than rewriting it into one generic voice.""",
    )


def notes_compiler_agent(
    script: str, structure: dict[str, Any], characters: dict[str, Any], dialogue: dict[str, Any]
) -> dict[str, Any]:
    client = get_client()
    source = json.dumps(
        {"structure": structure, "character_consistency": characters, "dialogue_quality": dialogue},
        ensure_ascii=False,
    )
    prompt = f"""You are the senior notes editor. Merge three specialist reports
into one clear, humane set of screenplay notes. Prioritize changes that will most
improve the draft. Do not contradict the reports without explaining why. Return
ONLY valid JSON, no markdown fences, using exactly this shape:
{{
  "logline_read": "string",
  "executive_summary": "string",
  "top_priorities": [
    {{"rank": 1, "title": "string", "note": "string", "impact": "string", "locations": ["string"]}}
  ],
  "act_notes": [
    {{"act": "Act I", "summary": "string", "notes": ["string"]}}
  ],
  "scene_by_scene": [
    {{"location": "string", "scene": "string", "note": "string", "priority": "high"}}
  ],
  "encouragement": "string"
}}
Use the original screenplay for scene references. Keep top_priorities to the most
important 3-5 items. Keep scene_by_scene concise and only include scenes that need
attention.

ORIGINAL SCREENPLAY:
---
{script}
---

SPECIALIST REPORTS:
{source}
"""
    try:
        return clean_json(generate_json(client, prompt, 0.25))
    except ValueError as error:
        if "empty response" in str(error):
            raise ValueError("Notes compiler returned an empty response.") from error
        raise


def run_specialists(script: str) -> dict[str, Any]:
    agents: dict[str, Callable[[str], dict[str, Any]]] = {
        "structure": structure_agent,
        "characters": character_consistency_agent,
        "dialogue": dialogue_quality_agent,
    }
    results: dict[str, Any] = {}
    with ThreadPoolExecutor(max_workers=3) as executor:
        jobs = {executor.submit(agent, script): name for name, agent in agents.items()}
        for future in as_completed(jobs):
            results[jobs[future]] = future.result()
    results["compiler"] = notes_compiler_agent(
        script, results["structure"], results["characters"], results["dialogue"]
    )
    return results


@app.post("/api/analyze")
def analyze() -> tuple[Any, int]:
    payload = request.get_json(silent=True) or {}
    script = payload.get("script")
    if not isinstance(script, str) or not script.strip():
        return jsonify({"error": "Paste a screenplay before requesting notes."}), 400
    if len(script) > 250_000:
        return jsonify({"error": "This draft is too large. Please keep it under 250,000 characters."}), 413
    try:
        agents = run_specialists(script.strip())
        return jsonify({"report": agents["compiler"], "agents": agents}), 200
    except json.JSONDecodeError:
        return jsonify({"error": "The analysis returned malformed notes. Please try again."}), 502
    except Exception as error:  # noqa: BLE001 - convert provider failures to a safe API response
        app.logger.exception("Screenplay analysis failed")
        message = str(error)
        if "GEMINI_API_KEY" in message:
            return jsonify({"error": "Gemini is not configured yet. Add GEMINI_API_KEY and try again."}), 503
        return jsonify({"error": "The script doctor could not finish this analysis. Please try again."}), 502


@app.get("/")
def index() -> Any:
    return send_from_directory(DIST_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path: str) -> Any:
    requested = DIST_DIR / path
    if requested.is_file():
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)