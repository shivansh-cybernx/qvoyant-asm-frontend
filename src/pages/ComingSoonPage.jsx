import { AsmLink as Link } from '../asmHref.jsx';

export default function ComingSoonPage({ title }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">
        This section is marked coming soon in the ASM product navigation. The route is wired so the demo sidebar matches the host module.
      </p>
      <p>
        <Link to="/">Back to dashboard</Link>
      </p>
    </section>
  );
}
