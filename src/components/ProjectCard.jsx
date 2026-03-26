import { Link } from 'react-router-dom';

function ProjectCard({ project }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <span className="chip chip-muted">{project.tool}</span>
        <span className="chip">{project.license}</span>
      </div>
      <h3>{project.title}</h3>
      <p className="project-meta">By {project.author}</p>
      <p>{project.summary}</p>

      <div className="tag-row">
        {project.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="project-stats">
        <span>★ {project.stars}</span>
        <span>Forks {project.forks}</span>
        <span>{project.difficulty}</span>
      </div>

      <Link className="inline-link" to={`/project/${project.id}`}>
        View project →
      </Link>
    </article>
  );
}

export default ProjectCard;
