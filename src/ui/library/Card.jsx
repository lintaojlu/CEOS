import React from 'react';

export function Card({ title, titleAside, note, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || titleAside || actions) && (
        <div className={titleAside ? 'card-head is-centered' : 'card-head'}>
          <div>
            <div className="card-title-line">
              {title ? <h2 className="card-title">{title}</h2> : null}
              {titleAside}
            </div>
            {note ? <p className="card-note">{note}</p> : null}
          </div>
          {actions ? <div className="card-actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
