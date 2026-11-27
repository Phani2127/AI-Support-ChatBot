import Icon from "./Icon";
import { DASHBOARD_ROUTES, type DashboardRoute } from "./dashboardRoutes";

type Props = {
  onNavigate: (path: DashboardRoute) => void;
};

const destinations = [
  {
    path: DASHBOARD_ROUTES.basicChat,
    icon: "chat" as const,
    number: "01",
    title: "AI Assistant",
    description: "Start a natural conversation and get quick, helpful responses.",
    label: "Open basic chat",
    tone: "blue"
  },
  {
    path: DASHBOARD_ROUTES.supportChat,
    icon: "headset" as const,
    number: "02",
    title: "FAQs & orders",
    description: "Find answers from your FAQs and look up customer order details.",
    label: "Explore support chat",
    tone: "red"
  },
  {
    path: DASHBOARD_ROUTES.documentChat,
    icon: "file" as const,
    number: "03",
    title: "Chat with documents",
    description: "Upload documents, then ask questions grounded in their contents.",
    label: "Explore document chat",
    tone: "violet"
  }
];

export default function DashboardHome({ onNavigate }: Props) {
  return (
    <main className="home-screen">
      <div className="home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-copy">
            <span className="home-eyebrow">
              <Icon name="sparkles" size={15} />
              ONE SMARTER SUPPORT WORKSPACE
            </span>
            <h1 id="home-title">
              Better answers.
              <span> Happier customers.</span>
            </h1>
            <p className="home-intro">
              AI Customer Support brings conversations, FAQs, orders, and your
              documents together—so finding a helpful answer feels effortless.
            </p>
            <div className="home-actions">
              <button
                type="button"
                className="button button-primary home-primary-action"
                onClick={() => onNavigate(DASHBOARD_ROUTES.basicChat)}
              >
                <Icon name="chat" size={17} />
                Start a conversation
              </button>
              <button
                type="button"
                className="home-secondary-action"
                onClick={() => onNavigate(DASHBOARD_ROUTES.documentChat)}
              >
                Explore document chat
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="home-highlights" aria-label="Application capabilities">
              <span><Icon name="check" size={15} />Grounded answers</span>
              <span><Icon name="check" size={15} />Document OCR</span>
              <span><Icon name="check" size={15} />Semantic search</span>
            </div>
          </div>

          <div className="home-art" aria-label="Illustration of connected AI support tools" role="img">
            <div className="art-orbit art-orbit-one" />
            <div className="art-orbit art-orbit-two" />
            <div className="art-spark art-spark-one"><Icon name="sparkles" size={19} /></div>
            <div className="art-spark art-spark-two"><Icon name="plus" size={13} /></div>
            <div className="art-window">
              <div className="art-window-bar">
                <span /><span /><span />
                <i>support workspace</i>
              </div>
              <div className="art-window-body">
                <div className="art-side-rail">
                  <b><Icon name="sparkles" size={15} /></b>
                  <span><Icon name="chat" size={14} /></span>
                  <span><Icon name="file" size={14} /></span>
                  <span><Icon name="headset" size={14} /></span>
                </div>
                <div className="art-conversation">
                  <div className="art-status"><i />AI ASSISTANT <span>READY TO HELP</span></div>
                  <div className="art-question">
                    <span className="art-mini-avatar"><Icon name="user" size={13} /></span>
                    <div><i /><i className="short" /></div>
                  </div>
                  <div className="art-answer">
                    <span className="art-mini-avatar assistant"><Icon name="bot" size={14} /></span>
                    <div className="art-answer-card">
                      <strong><Icon name="sparkles" size={12} /> A helpful answer, grounded in your knowledge.</strong>
                      <i /><i className="medium" /><i className="short" />
                    </div>
                  </div>
                  <div className="art-source">
                    <Icon name="file" size={13} />
                    <span>Source found in your documents</span>
                    <Icon name="check" size={13} />
                  </div>
                </div>
              </div>
              <div className="art-window-footer"><span>Ask anything about your support content</span><b><Icon name="send" size={14} /></b></div>
            </div>
            <div className="art-float-card art-float-top">
              <span className="art-float-icon"><Icon name="file" size={16} /></span>
              <span><b>Knowledge connected</b><small>FAQs · orders · documents</small></span>
              <Icon name="check" size={15} />
            </div>
            <div className="art-float-card art-float-bottom">
              <span className="art-live-dot" />
              <span><b>Context-aware</b><small>Answers with relevant sources</small></span>
            </div>
          </div>
        </section>

        <section className="home-tools" aria-labelledby="tools-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker">YOUR SUPPORT TOOLKIT</span>
              <h2 id="tools-title">Where would you like to start?</h2>
            </div>
            <p>Choose a workspace to jump right in.</p>
          </div>
          <div className="home-tool-grid">
            {destinations.map((destination) => (
              <button
                type="button"
                className={`home-tool-card ${destination.tone}`}
                key={destination.path}
                onClick={() => onNavigate(destination.path)}
              >
                <span className="home-card-top">
                  <span className="home-card-icon"><Icon name={destination.icon} size={20} /></span>
                  <span className="home-card-number">{destination.number}</span>
                </span>
                <strong className="home-card-title">{destination.title}</strong>
                <span className="home-card-description">{destination.description}</span>
                <span className="home-card-link">{destination.label}<span aria-hidden="true">↗</span></span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-flow" aria-label="How AI Customer Support works">
          <div className="home-flow-intro">
            <span className="home-section-kicker">HOW IT WORKS</span>
            <h2>From your knowledge<br />to a useful answer.</h2>
          </div>
          <div className="home-flow-step">
            <span className="flow-icon blue"><Icon name="upload" size={18} /></span>
            <span className="flow-step-number">STEP 01</span>
            <strong>Bring your knowledge</strong>
            <p>Use FAQs, order data, or upload your documents.</p>
          </div>
          <span className="home-flow-connector" aria-hidden="true" />
          <div className="home-flow-step">
            <span className="flow-icon red"><Icon name="sparkles" size={18} /></span>
            <span className="flow-step-number">STEP 02</span>
            <strong>Find relevant context</strong>
            <p>Search retrieves the information related to the question.</p>
          </div>
          <span className="home-flow-connector" aria-hidden="true" />
          <div className="home-flow-step">
            <span className="flow-icon violet"><Icon name="bot" size={18} /></span>
            <span className="flow-step-number">STEP 03</span>
            <strong>Answer with confidence</strong>
            <p>AI uses that context to shape a more useful response.</p>
          </div>
        </section>

        <footer className="home-footer">
          <span><span className="home-footer-mark"><Icon name="sparkles" size={14} /></span>AI Customer Support</span>
          <span>One workspace. More helpful conversations.</span>
        </footer>
      </div>
    </main>
  );
}
