import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clipboard,
  FileText,
  RotateCcw,
  ScanText,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';

type ReviewState = 'idle' | 'loading' | 'success' | 'error';
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface ReportData {
  [key: string]: JsonValue | undefined;
}

const SAMPLE_SCRIPT = `FADE IN:

INT. COMMUNITY RADIO STATION - NIGHT

The red ON AIR sign hums above MAYA (32), who watches the empty
phone lines. Rain folds itself against the window.

                         MAYA
             You ever notice how a city sounds
             different after midnight?

The phone rings. Maya lets it ring once. Twice.

                         MAYA (CONT'D)
             No. Me neither.

She picks up.

                         MAYA
             KJMR. You're on the air.

                         VOICE (V.O.)
             I found your brother's tape.

Maya's hand tightens around the receiver.

CUT TO BLACK.`;

const asText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return fallback;
};

const firstValue = (object: ReportData | undefined, keys: string[], fallback = ''): string => {
  if (!object) return fallback;
  for (const key of keys) {
    const value = object[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return fallback;
};

const asList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' || typeof item === 'number') return [String(item)];
    if (item && typeof item === 'object') {
      const itemObject = item as Record<string, unknown>;
      const text = itemObject.note ?? itemObject.text ?? itemObject.description ?? itemObject.title;
      return text ? [String(text)] : [];
    }
    return [];
  });
};

const getList = (report: ReportData, keys: string[], fallback: string[]): string[] => {
  for (const key of keys) {
    const list = asList(report[key]);
    if (list.length) return list;
  }
  return fallback;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const getRecords = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];

const recordText = (record: Record<string, unknown>, keys: string[], fallback = ''): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return fallback;
};

const recordList = (record: Record<string, unknown>, key: string): string[] =>
  Array.isArray(record[key]) ? record[key].filter((item): item is string => typeof item === 'string') : [];

function StatusPill({ children, tone = 'quiet' }: { children: string; tone?: 'quiet' | 'accent' | 'good' }) {
  return <span className={`status-pill status-pill-${tone}`} data-testid={`status-${children.toLowerCase().replace(/\s/g, '-')}`}>{children}</span>;
}

function ManuscriptPanel({
  script,
  setScript,
  onSubmit,
  onSample,
  onClear,
  state,
}: {
  script: string;
  setScript: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSample: () => void;
  onClear: () => void;
  state: ReviewState;
}) {
  const pageEstimate = Math.max(0, Math.ceil(script.trim().split(/\s+/).filter(Boolean).length / 180));
  return (
    <section className="manuscript-card rise-in delay-1" aria-label="Manuscript input">
      <div className="manuscript-card-head">
        <div className="manuscript-label">
          <span className="label-mark"><FileText size={13} strokeWidth={1.8} /></span>
          <span data-testid="text-manuscript-label">MANUSCRIPT / UNTITLED</span>
        </div>
        <div className="manuscript-meta script-mono" data-testid="text-manuscript-metadata">
          {script.length.toLocaleString()} chars <span className="meta-dot">·</span> {pageEstimate || 0} {pageEstimate === 1 ? 'page' : 'pages'}
        </div>
      </div>
      <form onSubmit={onSubmit}>
        <textarea
          data-testid="input-manuscript"
          value={script}
          onChange={(event) => setScript(event.target.value)}
          disabled={state === 'loading'}
          spellCheck={false}
          placeholder={'Paste your screenplay here…\n\nUse standard screenplay formatting where possible. The Doctor reads for story, structure, character, and the small choices that make a scene live.'}
          className="script-input"
          aria-label="Screenplay text"
        />
        <div className="manuscript-footer">
          <div className="input-actions">
            {script ? (
              <button type="button" onClick={onClear} className="text-button" data-testid="button-clear-manuscript">
                <X size={14} /> Clear
              </button>
            ) : (
              <button type="button" onClick={onSample} className="text-button" data-testid="button-use-sample">
                <Sparkles size={14} /> Try a sample
              </button>
            )}
            <span className="input-hint script-mono">TXT / FDX / pasted pages</span>
          </div>
          <button
            type="submit"
            disabled={!script.trim() || state === 'loading'}
            className="primary-button"
            data-testid="button-analyze-script"
          >
            <ScanText size={16} strokeWidth={1.8} />
            Get notes
            <ArrowUpRight size={16} strokeWidth={1.8} />
          </button>
        </div>
      </form>
    </section>
  );
}

function LoadingReview() {
  const steps = [
    ['01', 'Finding the spine', 'Story promise, stakes, and turning points'],
    ['02', 'Listening for voices', 'Character wants, contradictions, and rhythm'],
    ['03', 'Marking the pages', 'Scenes that sing, drag, or need a second look'],
  ];
  return (
    <section className="review-stage rise-in" aria-live="polite">
      <div className="stage-kicker script-mono">THE DOCTOR IS READING <span className="cursor-blink">_</span></div>
      <h2>Give us a minute<br /><em>with the pages.</em></h2>
      <p className="stage-intro">A close read takes a little attention. We're following the manuscript from first image to final beat.</p>
      <div className="analysis-progress"><span className="analysis-bar" /></div>
      <div className="analysis-steps">
        {steps.map(([number, title, description], index) => (
          <div className={`analysis-step ${index === 0 ? 'is-active' : ''}`} key={number} data-testid={`status-analysis-step-${number}`}>
            <span className="step-number script-mono">{number}</span>
            <span className="step-copy"><strong>{title}</strong><small>{description}</small></span>
            {index === 0 ? <span className="step-reading script-mono">READING</span> : <span className="step-line" />}
          </div>
        ))}
      </div>
      <p className="privacy-note"><span className="privacy-dot" /> Your manuscript stays in this session.</p>
    </section>
  );
}

function ErrorReview({ message, onRetry, onDismiss }: { message: string; onRetry: () => void; onDismiss: () => void }) {
  return (
    <section className="error-stage rise-in" role="alert" data-testid="status-analysis-error">
      <div className="error-icon"><TriangleAlert size={19} /></div>
      <div>
        <span className="stage-kicker script-mono">THE READ WAS INTERRUPTED</span>
        <h2>We couldn't reach<br /><em>the editor's desk.</em></h2>
        <p>{message || 'Something went wrong while reviewing these pages. Your manuscript is still here.'}</p>
        <div className="error-actions">
          <button type="button" className="primary-button" onClick={onRetry} data-testid="button-retry-analysis"><RotateCcw size={15} /> Try again</button>
          <button type="button" className="text-button" onClick={onDismiss} data-testid="button-dismiss-error">Back to manuscript</button>
        </div>
      </div>
    </section>
  );
}

function ReportSection({ eyebrow, title, children, className = '' }: { eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`report-section ${className}`} data-testid={`section-${eyebrow.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="section-eyebrow script-mono">{eyebrow}</div>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ReportView({ report, agents, script, onEdit, onNewReview }: { report: ReportData; agents: Record<string, unknown>; script: string; onEdit: () => void; onNewReview: () => void }) {
  const structureAgent = asRecord(agents.structure);
  const characterAgent = asRecord(agents.characters);
  const dialogueAgent = asRecord(agents.dialogue);
  const summary = firstValue(report, ['executive_summary', 'summary', 'overview', 'overallAssessment', 'overall_assessment'], 'A considered read of the manuscript, with the strongest opportunities gathered below.');
  const priorities = getRecords(report.top_priorities);
  const fallbackPriorities = getList(report, ['topPriorities', 'priorities', 'recommendations'], []);
  const acts = getRecords(report.act_notes);
  const fallbackActs = [
    { act: 'ACT I', summary: firstValue(asRecord(getRecords(structureAgent.acts)[0]) as ReportData, ['summary'], 'The setup establishes a compelling world and a question worth staying for.') },
    { act: 'ACT II', summary: firstValue(asRecord(getRecords(structureAgent.acts)[1]) as ReportData, ['summary'], 'Pressure is present; look for the midpoint that changes what the protagonist believes.') },
    { act: 'ACT III', summary: firstValue(asRecord(getRecords(structureAgent.acts)[2]) as ReportData, ['summary'], 'The ending has room to make the earlier choices feel inevitable, not simply complete.') },
  ];
  const characters = getRecords(characterAgent.characters);
  const characterAssessment = recordText(characterAgent, ['overall_assessment'], 'The character pass is looking for moments where voice, knowledge, and motivation drift from what the pages establish.');
  const dialogueScore = recordText(dialogueAgent, ['naturalness_score'], '—');
  const dialogueAssessment = recordText(dialogueAgent, ['overall_assessment', 'score_rationale'], 'The dialogue pass is listening for subtext, rhythm, and lines that explain what the scene already shows.');
  const sceneNotes = getRecords(report.scene_by_scene);
  const fallbackSceneNotes = getList(report, ['sceneByScene', 'sceneNotes', 'scenes'], []);
  const reportText = useMemo(() => JSON.stringify(report, null, 2), [report]);
  const [copied, setCopied] = useState(false);
  const copyReport = async () => {
    await navigator.clipboard?.writeText(reportText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="report-view rise-in" data-testid="container-review-report">
      <div className="report-header">
        <div>
          <div className="stage-kicker script-mono">REVIEW / COMPLETE</div>
          <h2 className="report-title">The pages, <em>closely read.</em></h2>
          <p className="report-summary" data-testid="text-report-summary">{summary}</p>
        </div>
        <div className="report-header-actions">
          <StatusPill tone="good">Read complete</StatusPill>
          <button type="button" className="icon-text-button" onClick={copyReport} data-testid="button-copy-report">
            {copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? 'Copied' : 'Copy report'}
          </button>
        </div>
      </div>

      <ReportSection eyebrow="01 / WHAT MATTERS MOST" title="Three notes to carry into the next draft." className="priority-section">
        <div className="priority-list">
          {(priorities.length ? priorities : fallbackPriorities.map((note, index) => ({ rank: index + 1, note }))).slice(0, 3).map((priority, index) => (
            <article className="priority-item" key={`${recordText(priority, ['title', 'note'])}-${index}`} data-testid={`card-priority-${index + 1}`}>
              <span className="priority-index script-mono">0{index + 1}</span>
              <div className="priority-copy">
                <strong>{recordText(priority, ['title'], `Priority ${index + 1}`)}</strong>
                <p>{recordText(priority, ['note', 'description'], 'A focused revision opportunity surfaced in the read.')}</p>
                {recordText(priority, ['impact']) && <small>{recordText(priority, ['impact'])}</small>}
              </div>
              <ArrowUpRight size={16} className="priority-arrow" />
            </article>
          ))}
        </div>
      </ReportSection>

      <ReportSection eyebrow="02 / SHAPE & MOMENTUM" title="The story's movement." className="structure-section">
        <div className="act-grid">
          {(acts.length ? acts : fallbackActs).map((act, index) => (
            <article className={`act-card act-${index + 1}`} key={recordText(act, ['act'], `Act ${index + 1}`)} data-testid={`card-act-${index + 1}`}>
              <div className="act-card-top"><span className="script-mono">{recordText(act, ['act'], `ACT ${index + 1}`)}</span><span className="act-dash" /></div>
              <p>{recordText(act, ['summary', 'note'], 'No act summary was returned.')}</p>
              {recordList(act, 'notes').length > 0 && <ul className="act-notes">{recordList(act, 'notes').slice(0, 2).map((note) => <li key={note}>{note}</li>)}</ul>}
            </article>
          ))}
        </div>
      </ReportSection>

      <div className="report-two-up">
        <ReportSection eyebrow="03 / PEOPLE" title="Character consistency">
          <p className="report-copy" data-testid="text-character-notes">{characterAssessment}</p>
          {characters.length > 0 && <ul className="inline-notes">{characters.slice(0, 3).map((character) => {
            const inconsistencies = getRecords(character.inconsistencies);
            return <li key={recordText(character, ['name'], 'Character')}><strong>{recordText(character, ['name'], 'Character')}</strong><span>{inconsistencies.length ? recordText(inconsistencies[0], ['issue', 'suggestion']) : recordText(character, ['voice_profile'], 'Distinct voice profile established.')}</span></li>;
          })}</ul>}
          <div className="mini-meter"><span style={{ width: characters.length ? '82%' : '64%' }} /><small className="script-mono">CONSISTENCY / PASS COMPLETE</small></div>
        </ReportSection>
        <ReportSection eyebrow="04 / THE SPOKEN WORD" title="Dialogue quality">
          <div className="dialogue-score"><span>{dialogueScore}</span><small className="script-mono">/ 10 NATURALNESS</small></div>
          <p className="report-copy" data-testid="text-dialogue-notes">{dialogueAssessment}</p>
          {getRecords(dialogueAgent.on_the_nose_lines).length > 0 && <p className="dialogue-flag"><TriangleAlert size={13} /> {getRecords(dialogueAgent.on_the_nose_lines).length} on-the-nose line{getRecords(dialogueAgent.on_the_nose_lines).length === 1 ? '' : 's'} flagged</p>}
        </ReportSection>
      </div>

      <ReportSection eyebrow="05 / IN THE MARGINS" title="Scene-by-scene notes." className="scene-section">
        <div className="scene-list">
          {(sceneNotes.length ? sceneNotes : fallbackSceneNotes.map((note, index) => ({ location: `Scene ${index + 1}`, scene: note, note }))).map((scene, index) => (
            <details key={`${recordText(scene, ['location', 'scene'])}-${index}`} className="scene-note" open={index === 0}>
              <summary data-testid={`button-scene-note-${index + 1}`}><span className="script-mono">SCENE {String(index + 1).padStart(2, '0')}</span><span>{recordText(scene, ['location', 'scene'], `Scene ${index + 1}`)}</span><ChevronDown size={16} /></summary>
              <p>{recordText(scene, ['note', 'description'], 'A scene-level revision note will appear here.')}</p>
            </details>
          ))}
        </div>
      </ReportSection>

      {Object.keys(agents).length > 0 && (
        <div className="agent-footnote script-mono" data-testid="text-agent-summary">
          <span><Sparkles size={13} /> MULTI-PASS READ</span>
          {Object.keys(agents).length - (agents.compiler ? 1 : 0)} specialist perspectives folded into this report.
        </div>
      )}
      <div className="report-footer">
        <span className="script-mono">{script.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} WORDS REVIEWED</span>
        <div>
          <button type="button" className="text-button" onClick={onEdit} data-testid="button-edit-manuscript">Edit manuscript</button>
          <button type="button" className="primary-button" onClick={onNewReview} data-testid="button-new-review"><RotateCcw size={15} /> New review</button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [script, setScript] = useState('');
  const [state, setState] = useState<ReviewState>('idle');
  const [report, setReport] = useState<ReportData | null>(null);
  const [agents, setAgents] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!script.trim()) return;
    setState('loading');
    setError('');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      const rawBody = await response.text();
      let data: { report?: ReportData; agents?: Record<string, unknown>; error?: string } & ReportData;
      try {
        data = JSON.parse(rawBody) as typeof data;
      } catch {
        throw new Error(
          response.ok
            ? 'The review service returned an invalid response. Please try again.'
            : `The review service returned ${response.status}. Please try again.`,
        );
      }
      if (!response.ok) {
        throw new Error(data.error || `The review service returned ${response.status}.`);
      }
      if (!data.report && !data.executive_summary) {
        throw new Error('The review service returned incomplete notes. Please try again.');
      }
      setReport(data.report ?? data);
      setAgents(data.agents ?? {});
      setState('success');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The review could not be completed.');
      setState('error');
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void analyze();
  };

  const reset = () => {
    setScript('');
    setReport(null);
    setAgents({});
    setError('');
    setState('idle');
  };

  return (
    <div className="doctor-app grain">
      <aside className="app-sidebar">
        <div className="brand-lockup">
          <div className="brand-stamp">SD</div>
          <div><strong>Script Doctor</strong><span className="script-mono">A CLOSE READ</span></div>
        </div>
        <div className="sidebar-rule" />
        <div className="sidebar-manuscript">
          <span className="sidebar-kicker script-mono">CURRENT MANUSCRIPT</span>
          <div className="sidebar-title">{state === 'success' ? 'Untitled review' : 'No draft loaded'}</div>
          <div className="sidebar-status"><span className={state === 'success' ? 'status-light active' : 'status-light'} />{state === 'success' ? 'Review complete' : 'Waiting for pages'}</div>
        </div>
        <div className="sidebar-principle">
          <div className="principle-mark">“</div>
          <p>Good notes don't tell a writer what to do. They show them what the story is already trying to become.</p>
          <span className="script-mono">— THE DESK</span>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-rule" />
          <span className="script-mono">PRIVATE WORKSPACE / 01</span>
        </div>
      </aside>

      <main className="main-stage">
        <header className="topbar">
          <div className="topbar-crumb script-mono"><span className="crumb-dot" /> SCRIPT DOCTOR <span>/</span> WORKSPACE</div>
          <div className="topbar-session"><span className="session-line" /> PRIVATE SESSION</div>
        </header>
        <div className="stage-content">
          {state === 'idle' && (
            <>
              <div className="intro-block rise-in">
                <div className="stage-kicker script-mono">A SECOND SET OF EYES, WITHOUT THE NOISE</div>
                <h1>Put the pages<br /><em>under a better light.</em></h1>
                <p>Paste in your screenplay. The Doctor will read for story, shape, character, and the small choices that make a scene live.</p>
              </div>
              <ManuscriptPanel script={script} setScript={setScript} onSubmit={submit} onSample={() => setScript(SAMPLE_SCRIPT)} onClear={() => setScript('')} state={state} />
              <div className="empty-note rise-in delay-2">
                <div className="empty-note-icon"><Sparkles size={16} /></div>
                <div><strong data-testid="text-empty-title">Your desk is clear.</strong><span>Start with a scene, a sequence, or the whole draft. There is no wrong place to begin.</span></div>
              </div>
            </>
          )}
          {state === 'loading' && <LoadingReview />}
          {state === 'error' && (
            <>
              <div className="intro-block compact-intro rise-in">
                <div className="stage-kicker script-mono">MANUSCRIPT / UNTITLED</div>
                <h1>One more pass<br /><em>might do it.</em></h1>
              </div>
              <ErrorReview message={error} onRetry={() => void analyze()} onDismiss={() => setState('idle')} />
            </>
          )}
          {state === 'success' && report && <ReportView report={report} agents={agents} script={script} onEdit={() => setState('idle')} onNewReview={reset} />}
        </div>
      </main>
    </div>
  );
}