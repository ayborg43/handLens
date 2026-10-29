import { BrandMark } from './Icons.jsx';

export function AppBar({ sub, children }) {
  return (
    <header className="appbar">
      <h1 className="brand">
        <a className="brand-link" href="#/" aria-label="handLens home">
          <BrandMark />
          <span>handLens{sub && <small> {sub}</small>}</span>
        </a>
      </h1>
      <div className="appbar-tools">{children}</div>
    </header>
  );
}
