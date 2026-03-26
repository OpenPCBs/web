function SectionHeading({ eyebrow, title, body, align = 'left' }) {
  return (
    <div className={`section-heading section-heading-${align}`}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export default SectionHeading;
