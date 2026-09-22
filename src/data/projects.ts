export interface Project {
  title: string;
  description: string;
  tags: string[];
  link?: string;
  video?: string;
  demo?: string;
  latest?: boolean;
  featured: boolean;
}

export const projects: Project[] = [
  {
    title: "EvalBudget",
    description: "Adaptive evaluation toolkit for paired model outputs that uses anytime-valid confidence sequences to stop once the evidence is decisive, while preserving raw outputs, grader configuration, and category-level results for auditability.",
    tags: ["Python", "Sequential Testing", "LLM Evaluation", "Confidence Sequences"],
    link: "https://github.com/JDKrasnick/evalbudget",
    latest: true,
    featured: true,
  },
  {
    title: "Agent Arena",
    description: "Adversarial verification harness that ran 20+ PR-defense matches across Claude Code, Codex, and Gemini CLI, promoting only four-run reproducible test attacks and preserving resumable evidence across up to five attack-repair rounds.",
    tags: ["TypeScript", "Node.js", "Vitest", "Zod", "Git Worktrees", "AI Agents"],
    link: "https://github.com/JDKrasnick/agentarena",
    featured: true,
  },
  {
    title: "Mechanistic Routing",
    description: "Research prototype for budget-aware LLM adaptation, using a counterfactual critic to route among prompt, activation-steering, and LoRA interventions without exhaustively running every candidate.",
    tags: ["Python", "PyTorch", "Transformers", "LoRA", "Activation Steering", "Qwen"],
    link: "https://github.com/JDKrasnick/mechanistic-routing",
    featured: true,
  },
  {
    title: "Alloc",
    description: "Local financial-intelligence agent that turns 36,000 transaction-level records across three companies into cited insights and forecasts, with 39–71 ms retrieval and deterministic, crash-safe proposal triage.",
    tags: ["TypeScript", "OpenClaw", "Qwen", "Fastify", "MongoDB", "Human in the Loop"],
    featured: false,
  },
  {
    title: "Ntern",
    description: "Open-source opportunity radar for technical internships and early-career roles, designed to surface credible openings and take candidates to the employer’s official application.",
    tags: ["TypeScript", "Expo", "React Native", "Cloudflare Workers", "D1", "Queues"],
    link: "https://github.com/JDKrasnick/Ntern",
    demo: "https://ntern.app/",
    featured: false,
  },
  {
    title: "Discrete Event Simulator",
    description: "Interactive queueing-network simulator with a drag-and-drop canvas, WebSocket streaming, pluggable scheduling policies, and Gym-style environments for reinforcement-learning experiments.",
    tags: ["Python", "FastAPI", "WebSockets", "Reinforcement Learning", "Queueing Theory"],
    link: "https://github.com/JDKrasnick/DiscreteEventSimulator",
    featured: false,
  },
  {
    title: "The Workflow Gambit",
    description: "Controlled nine-person experiment comparing AI-assisted development workflows by having each one build a UCI chess engine from the same specification and scoring the results with a shared evaluation harness.",
    tags: ["Python", "LLM Workflows", "Evaluation", "Chess Engines", "UCI"],
    link: "https://github.com/JDKrasnick/Point72Hackathon",
    featured: false,
  },
  {
    title: "MarketSent",
    description: "Stock-market sentiment dashboard that tracks ticker mentions, directional sentiment, daily trends, and the source items behind each signal. Its bundled dataset refreshes every six hours.",
    tags: ["Python", "FinBERT", "Flask", "PostgreSQL", "React", "Recharts"],
    link: "https://github.com/JDKrasnick/MarketSent",
    demo: "https://marketsent.jdkrasnick.com/",
    featured: false,
  },
];
