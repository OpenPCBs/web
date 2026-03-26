function FeatureCard({ title, body, eyebrow }) {
  return (
    <div className="feature-card">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export default FeatureCard;
