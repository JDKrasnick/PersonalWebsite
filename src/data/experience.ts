export interface Experience {
  role: string;
  company: string;
  companyUrl: string;
  period: string;
  /** ISO 8601 year-month the role started. */
  startDate: string;
  /** ISO 8601 year-month the role ended; omitted while the role is ongoing. */
  endDate?: string;
  /**
   * Relationship to `company`, which decides how the role is expressed in
   * structured data: `employee` -> EmployeeRole/worksFor, `member` ->
   * OrganizationRole/memberOf, `affiliate` -> OrganizationRole/affiliation.
   * Omitted where the page credits an individual rather than an organization.
   */
  association?: "employee" | "member" | "affiliate";
  /** schema.org type for the company node in structured data. */
  companyType?: "Organization" | "CollegeOrUniversity";
  /** Canonical organization URL when it differs from the displayed link. */
  organizationUrl?: string;
  highlights: string[];
  tags: string[];
}

export const experiences: Experience[] = [
  {
    role: "AI Engineer Intern",
    company: "Order.co",
    companyUrl: "https://www.order.co",
    period: "May — Aug 2026",
    startDate: "2026-05",
    endDate: "2026-08",
    association: "employee",
    companyType: "Organization",
    highlights: [
      "Built AI systems for product-offer ingestion and location-aware pricing",
      "Developed LLM evaluation workflows using production traces and analyst dashboards",
      "Created browser-interaction agents for dynamic vendor websites",
    ],
    tags: ["Python", "LLM Evaluations", "Airflow", "Snowflake", "Browserbase", "Firecrawl"],
  },
  {
    role: "Research Lead · previously AI Engineer",
    company: "Generative AI at Cornell",
    companyUrl: "https://www.cornellgenai.dev/",
    period: "Feb 2026 — Present",
    startDate: "2026-02",
    association: "member",
    companyType: "Organization",
    highlights: [
      "Leading research on <b>agent-harness optimization</b>",
      "Built AI workflows for ESG monitoring and financial analysis",
      "Developed LLM-based data pipelines and analyst tools for citation-backed insights",
    ],
    tags: ["TypeScript", "AI Agents", "GPT-4o", "BullMQ", "Redis", "PostgreSQL"],
  },
  {
    role: "Financial Software Engineer",
    company: "Cornell FinTech Club",
    companyUrl: "https://www.cornellfintechclub.com/",
    period: "Jan 2026 — Present",
    startDate: "2026-01",
    association: "member",
    companyType: "Organization",
    highlights: [
      "Developed loan-approval workflow software with Next.js, FastAPI, and PostgreSQL",
      "Built configurable credit rules and ML models for default-risk scoring",
      "Automated document extraction and audit logging for credit decisions",
    ],
    tags: ["Next.js", "FastAPI", "PostgreSQL", "Machine Learning", "Audit Logging"],
  },
  {
    role: "Undergraduate Researcher",
    company: "Cornell University",
    companyUrl: "https://www.orie.cornell.edu",
    period: "Jan 2026 — Present",
    startDate: "2026-01",
    association: "affiliate",
    companyType: "CollegeOrUniversity",
    organizationUrl: "https://www.cornell.edu",
    highlights: [
      "Researching routing and scheduling in multiclass queueing networks, advised by Professor Dai",
      "Researching deep reinforcement learning for LLM inference optimization",
      "Built discrete-event simulators and Gym-style environments for queueing-network research",
    ],
    tags: ["Deep Reinforcement Learning", "PyTorch", "OpenAI Gym", "FastAPI", "WebSockets", "Queueing Theory"],
  },
  {
    role: "Data Engineer",
    company: "University of Pennsylvania Law Professor",
    companyUrl: "https://www.law.upenn.edu/",
    period: "Jun 2025 — Aug 2025",
    startDate: "2025-06",
    endDate: "2025-08",
    highlights: [
      "Built data pipelines from websites and PDF documents",
      "Cleaned and structured research datasets for analysis",
    ],
    tags: ["Data Pipelines", "Web Data", "PDF Processing", "Data Analysis"],
  },
];
