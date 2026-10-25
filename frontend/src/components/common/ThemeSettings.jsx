import { useEffect } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { THEMES, useTheme } from '../../context/ThemeContext';

function ThemePreview({ theme, colors, active }) {
  const [primary, accent, background, surface] = colors;
  return (
    <div className="theme-preview" style={{ '--preview-primary': primary, '--preview-accent': accent, '--preview-bg': background, '--preview-surface': surface }} aria-hidden="true">
      <div className="theme-preview-sidebar"><i /><i /><i /></div>
      <div className="theme-preview-main">
        <div className="theme-preview-top"><span /><b>{active ? <FiCheck /> : null}</b></div>
        <div className="theme-preview-banner"><span /><i /></div>
        <div className="theme-preview-cards"><i /><i /><i /></div>
        <div className="theme-preview-button" />
      </div>
      <span className="sr-only">Preview of {theme}</span>
    </div>
  );
}

export default function ThemeSettings({ open, onClose }) {
  const { theme: activeTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="theme-settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="theme-settings-panel" role="dialog" aria-modal="true" aria-labelledby="theme-settings-title">
        <header className="theme-settings-header">
          <div>
            <p className="theme-settings-eyebrow">Make it yours</p>
            <h2 id="theme-settings-title">Choose your theme</h2>
            <p className="theme-settings-description">Preview a palette and switch the whole shop instantly.</p>
          </div>
          <button className="theme-settings-close" type="button" onClick={onClose} aria-label="Close theme settings"><FiX /></button>
        </header>

        <div className="theme-settings-grid">
          {Object.entries(THEMES).map(([id, details]) => {
            const active = activeTheme === id;
            return (
              <button
                key={id}
                type="button"
                className={`theme-choice${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => setTheme(id)}
              >
                <ThemePreview theme={details.name} colors={details.colors} active={active} />
                <span className="theme-choice-info">
                  <span className="theme-choice-title">{details.name}{active && <span className="theme-active-label">Active</span>}</span>
                  <span className="theme-choice-description">{details.description}</span>
                  <span className="theme-swatches" aria-label={`${details.name} color palette`}>
                    {details.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="theme-settings-footnote">Your selection is saved on this device.</p>
      </section>
    </div>
  );
}
