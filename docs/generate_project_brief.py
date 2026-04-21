from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


PAGE_WIDTH, PAGE_HEIGHT = A4
DOC_PATH = "docs/project-brief.pdf"


def add_arrow(drawing, x1, y1, x2, y2, color=colors.HexColor("#2F4F6E"), width=1.4):
    drawing.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=width))
    if x2 >= x1:
        points = [x2, y2, x2 - 7, y2 + 3, x2 - 7, y2 - 3]
    else:
        points = [x2, y2, x2 + 7, y2 + 3, x2 + 7, y2 - 3]
    drawing.add(Polygon(points=points, fillColor=color, strokeColor=color))


def wrap_text(text, max_width, font_name, font_size):
    words = text.split()
    if not words:
        return []

    lines = []
    current = words[0]

    for word in words[1:]:
        candidate = f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word

    lines.append(current)
    return lines


def fit_wrapped_lines(text, max_width, font_name, start_size, min_size, max_lines):
    size = start_size
    lines = wrap_text(text, max_width, font_name, size)
    while size > min_size and len(lines) > max_lines:
        size -= 0.5
        lines = wrap_text(text, max_width, font_name, size)
    return lines, size


def labeled_box(
    drawing,
    x,
    y,
    w,
    h,
    title,
    subtitle=None,
    fill="#F5F7FA",
    stroke="#50667F",
):
    drawing.add(
        Rect(
            x,
            y,
            w,
            h,
            rx=10,
            ry=10,
            fillColor=colors.HexColor(fill),
            strokeColor=colors.HexColor(stroke),
            strokeWidth=1.4,
        )
    )

    title_lines, title_size = fit_wrapped_lines(
        title,
        w - 12,
        "Helvetica-Bold",
        11,
        8.5,
        2,
    )
    subtitle_lines = []
    subtitle_size = 8.2
    if subtitle:
        subtitle_lines, subtitle_size = fit_wrapped_lines(
            subtitle,
            w - 14,
            "Helvetica",
            8.2,
            6.8,
            2,
        )

    title_leading = title_size + 1.5
    subtitle_leading = subtitle_size + 1.0
    gap = 3 if subtitle_lines else 0
    total_height = (
        len(title_lines) * title_leading
        + len(subtitle_lines) * subtitle_leading
        + gap
    )
    current_y = y + (h + total_height) / 2 - title_leading + 1

    for line in title_lines:
        drawing.add(
            String(
                x + w / 2,
                current_y,
                line,
                fontName="Helvetica-Bold",
                fontSize=title_size,
                textAnchor="middle",
                fillColor=colors.HexColor("#142130"),
            )
        )
        current_y -= title_leading

    if subtitle_lines:
        current_y -= gap - 1
        for line in subtitle_lines:
            drawing.add(
                String(
                    x + w / 2,
                    current_y,
                    line,
                    fontName="Helvetica",
                    fontSize=subtitle_size,
                    textAnchor="middle",
                    fillColor=colors.HexColor("#44576C"),
                )
            )
            current_y -= subtitle_leading


def architecture_diagram():
    d = Drawing(170 * mm, 80 * mm)
    labeled_box(d, 10, 104, 112, 50, "Next.js Desktop UI", "Launchpad · Chat · Settings")
    labeled_box(d, 140, 104, 90, 50, "Tauri Shell", "Native window + IPC")
    labeled_box(d, 248, 104, 114, 50, "Rust Backend", "Providers · Tools · Storage")

    labeled_box(
        d,
        12,
        34,
        118,
        42,
        "Granted Project",
        "Directory-scoped tool boundary",
        fill="#F8FAFC",
    )
    labeled_box(d, 252, 34, 68, 42, "SQLite", "Local state", fill="#F8FAFC")
    labeled_box(d, 330, 34, 70, 42, "OS Keyring", "Credentials", fill="#F8FAFC")
    labeled_box(d, 410, 34, 70, 42, "LLM Providers", "Cloud + local", fill="#F8FAFC")

    add_arrow(d, 122, 129, 140, 129)
    add_arrow(d, 230, 129, 248, 129)
    add_arrow(d, 305, 104, 286, 76)
    add_arrow(d, 326, 104, 365, 76)
    add_arrow(d, 352, 104, 445, 76)
    add_arrow(d, 252, 55, 130, 55)
    return d


def hub_spoke_diagram():
    d = Drawing(170 * mm, 78 * mm)
    labeled_box(d, 14, 90, 82, 36, "User", fill="#F8FAFC")
    labeled_box(
        d,
        164,
        84,
        146,
        50,
        "Conversation Workspace Hub",
        "Shared context + controls",
    )
    labeled_box(d, 364, 124, 108, 38, "Software Engineer", fill="#F5FBFF")
    labeled_box(d, 364, 36, 108, 38, "Cybersecurity Specialist", fill="#F5FBFF")
    labeled_box(d, 170, 8, 138, 36, "Tool + Approval Boundary", fill="#F8FAFC")

    add_arrow(d, 96, 108, 164, 108)
    add_arrow(d, 310, 116, 364, 143)
    add_arrow(d, 310, 100, 364, 55)
    add_arrow(d, 238, 84, 238, 44)
    add_arrow(d, 364, 128, 364, 74)
    d.add(
        String(
            330,
            103,
            "consult / handoff",
            fontName="Helvetica",
            fontSize=8,
            fillColor=colors.HexColor("#5C7086"),
        )
    )
    return d


def approval_diagram():
    d = Drawing(170 * mm, 86 * mm)
    labeled_box(d, 12, 114, 68, 34, "User Prompt", fill="#F8FAFC")
    labeled_box(d, 98, 114, 68, 34, "Agent Turn", fill="#F8FAFC")
    labeled_box(d, 184, 114, 102, 34, "Tool Call + Preview", fill="#F5FBFF")
    labeled_box(d, 306, 114, 76, 34, "Decision", fill="#F8FAFC")

    labeled_box(d, 244, 60, 76, 32, "Approve", fill="#F1FAF5", stroke="#3A7A56")
    labeled_box(d, 344, 60, 76, 32, "Deny", fill="#FFF8E8", stroke="#A67C1B")
    labeled_box(
        d,
        176,
        10,
        196,
        34,
        "Execution / Logging / Tool Result",
        fill="#F8FAFC",
    )

    add_arrow(d, 80, 131, 98, 131)
    add_arrow(d, 166, 131, 184, 131)
    add_arrow(d, 286, 131, 306, 131)
    add_arrow(d, 344, 114, 282, 92)
    add_arrow(d, 344, 114, 382, 92)
    add_arrow(d, 282, 60, 274, 44)
    add_arrow(d, 382, 60, 274, 44)
    return d


def bullet_list(items, styles):
    return ListFlowable(
        [ListItem(Paragraph(item, styles["BodyText"])) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=16,
    )


def build_pdf():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="BodySmall",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor("#243547"),
            spaceAfter=6,
        )
    )
    styles["Title"].fontName = "Helvetica-Bold"
    styles["Title"].fontSize = 22
    styles["Title"].leading = 28
    styles["Title"].textColor = colors.HexColor("#122033")
    styles["Heading1"].fontName = "Helvetica-Bold"
    styles["Heading1"].fontSize = 15
    styles["Heading1"].leading = 20
    styles["Heading1"].textColor = colors.HexColor("#122033")
    styles["Heading2"].fontName = "Helvetica-Bold"
    styles["Heading2"].fontSize = 11.5
    styles["Heading2"].leading = 15
    styles["Heading2"].textColor = colors.HexColor("#1C3148")
    styles["BodyText"].fontName = "Helvetica"
    styles["BodyText"].fontSize = 10
    styles["BodyText"].leading = 14
    styles["BodyText"].textColor = colors.HexColor("#243547")

    doc = SimpleDocTemplate(
        DOC_PATH,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Pantheon Forge Project Brief",
        author="Pantheon Forge",
    )

    story = [
        Paragraph("Pantheon Forge", styles["Title"]),
        Paragraph(
            "Project Brief for Public Repository and Master's Application Review",
            styles["Heading2"],
        ),
        Spacer(1, 6),
        Paragraph(
            "Pantheon Forge is a local-first desktop AI agent workspace that combines a "
            "Next.js interface, a Tauri shell, and a Rust backend to support specialist "
            "agents, multiple LLM providers, and approval-gated local tool execution.",
            styles["BodyText"],
        ),
        Spacer(1, 8),
        Paragraph("Research Motivation", styles["Heading1"]),
        Paragraph(
            "Pantheon Forge is motivated by a practical research question: what should an "
            "AI agent workspace look like when the goal is not maximum autonomy, but useful "
            "human-directed agency with explicit safety boundaries? Many agent systems optimize "
            "for capability demos, while leaving execution policy, local control, and operator "
            "oversight under-specified.",
            styles["BodyText"],
        ),
        Paragraph(
            "This project explores a different framing. It treats the desktop as an "
            "experimental environment for studying agent interaction patterns, specialist role "
            "boundaries, tool-use transparency, and human approval as part of the interaction "
            "loop rather than as an afterthought.",
            styles["BodyText"],
        ),
        Spacer(1, 6),
        Paragraph("Design Goals", styles["Heading1"]),
        bullet_list(
            [
                "Build a desktop-native AI workspace rather than a browser-only dashboard.",
                "Keep conversations, settings, and provider credentials local to the machine.",
                "Make agent behavior explicit through specialist personas and visible control boundaries.",
                "Require user approval before tools read files, modify code, or run commands.",
                "Support both cloud and local model gateways through one shared interaction model.",
            ],
            styles,
        ),
        Spacer(1, 10),
        Paragraph("High-Level Architecture", styles["Heading1"]),
        Paragraph(
            "The frontend owns interaction and presentation, while the Rust backend owns "
            "provider routing, tool execution, and local persistence.",
            styles["BodyText"],
        ),
        Spacer(1, 4),
        architecture_diagram(),
        PageBreak(),
        Paragraph("Hub-Spoke Agent Model", styles["Heading1"]),
        Paragraph(
            "Pantheon Forge is organized around a shared conversation hub. Specialist agents "
            "act as spokes attached to the same workspace context instead of separate, opaque bots.",
            styles["BodyText"],
        ),
        Paragraph(
            "This model is also research-relevant: it makes delegation legible. Rather than "
            "treating a multi-agent system as a hidden orchestration graph, the architecture "
            "keeps the user at the center of a hub where specialist roles can be selected, "
            "consulted, and eventually handed work in a controlled way.",
            styles["BodyText"],
        ),
        Spacer(1, 4),
        hub_spoke_diagram(),
        Spacer(1, 10),
        Paragraph("Approval-Gated Tool Execution", styles["Heading1"]),
        Paragraph(
            "Tool use is explicit. The model can request an action, but execution only happens "
            "after the user sees a preview and approves the call.",
            styles["BodyText"],
        ),
        Paragraph(
            "From a research perspective, this creates a clean human-in-the-loop boundary. The "
            "system can be evaluated not only on task completion, but also on whether it asks for "
            "the right actions, presents intelligible previews, and recovers well from denial or "
            "partial permission.",
            styles["BodyText"],
        ),
        Spacer(1, 4),
        approval_diagram(),
        PageBreak(),
        Paragraph("Current Implementation Status", styles["Heading1"]),
        bullet_list(
            [
                "Desktop shell built with Tauri 2 and a Next.js 16 / React 19 frontend.",
                "Rust backend for provider adapters, IPC orchestration, and local tool execution.",
                "Local persistence with SQLite and secure credential storage in the OS keyring.",
                "Provider support for Anthropic, OpenAI, DeepSeek, Google Gemini, and Ollama-compatible local gateways.",
                "Project-scoped tools for reading, searching, writing files, and curated command execution.",
                "Per-call approval previews and persisted execution history.",
            ],
            styles,
        ),
        Spacer(1, 10),
        Paragraph("AI/Agent Research Relevance", styles["Heading1"]),
        bullet_list(
            [
                "Human oversight as part of the agent interaction model rather than an external safety layer.",
                "Role-based specialist agents with explicit tool boundaries instead of one monolithic assistant.",
                "A shared workspace that supports comparison across multiple providers and local gateways.",
                "A practical environment for studying when users trust, reject, or revise agent-requested actions.",
            ],
            styles,
        ),
        Spacer(1, 8),
        Paragraph("Why the Project Is Technically Meaningful", styles["Heading1"]),
        Paragraph(
            "The project is interesting because it combines several concerns that are often "
            "treated separately: desktop UX, local system integration, provider abstraction, "
            "stateful conversation history, and explicit execution approval. Rather than being "
            "a generic chatbot wrapper, Pantheon Forge explores a structured runtime for "
            "human-directed agent work.",
            styles["BodyText"],
        ),
        Spacer(1, 6),
        Paragraph(
            "From an engineering perspective, it demonstrates a practical full-stack split "
            "between a modern React interface and a safety-oriented Rust backend, with a local-first "
            "security model that keeps users in control of credentials, project access, and tool execution.",
            styles["BodyText"],
        ),
        Spacer(1, 8),
        Paragraph("Current Limitations", styles["Heading1"]),
        bullet_list(
            [
                "The current release focuses on single-user desktop workflows rather than collaborative deployment.",
                "Specialist tooling is still concentrated around software engineering tasks and core local actions.",
                "Multi-agent delegation is represented architecturally today, but not yet fully operationalized.",
                "The project emphasizes safe execution and transparency over raw autonomous breadth.",
            ],
            styles,
        ),
        Spacer(1, 8),
        Paragraph("Future Improvements and Research Directions", styles["Heading1"]),
        bullet_list(
            [
                "Expand specialist tooling to support deeper cybersecurity and analysis workflows.",
                "Study delegation protocols between specialist agents and how users interpret handoffs.",
                "Evaluate approval UX quality: preview clarity, denial recovery, and trust calibration.",
                "Compare local and cloud providers under the same task and tool-execution model.",
                "Explore evaluation metrics for bounded agency, including action usefulness, permission friction, and operator confidence.",
            ],
            styles,
        ),
    ]

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
