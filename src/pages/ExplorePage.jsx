import { useMemo, useState } from 'react';
import ProjectCard from '../components/ProjectCard';

function ExplorePage({ projects, isSupabaseConfigured, projectsLoading, projectsError }) {
  const [query, setQuery] = useState('');
  const [toolFilter, setToolFilter] = useState('All');

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const searchText = `${project.title} ${project.author} ${project.summary} ${project.tags.join(' ')} ${project.category}`.toLowerCase();
      const queryMatch = searchText.includes(query.toLowerCase());
      const toolMatch = toolFilter === 'All' || project.tool === toolFilter;
      return queryMatch && toolMatch;
    });
  }, [projects, query, toolFilter]);

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading compact-heading">
          <span className="eyebrow">Explore</span>
          <h1>Find open hardware that is already halfway to usable</h1>
          <p>
            Search by keyword, tool, and board type. Public projects are loaded from
            Supabase when configured, and seeded demo boards remain available as fallback.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="status-banner status-banner-warning">
            Supabase environment variables are missing, so the app is showing starter data only.
          </div>
        ) : null}

        {projectsError ? <div className="status-banner status-banner-error">{projectsError}</div> : null}

        <div className="filters-shell">
          <label className="filter-field">
            <span>Search</span>
            <input
              type="text"
              placeholder="USB-C, RFID, buck converter..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label className="filter-field">
            <span>EDA tool</span>
            <select value={toolFilter} onChange={(event) => setToolFilter(event.target.value)}>
              <option>All</option>
              <option>KiCad</option>
              <option>Altium</option>
            </select>
          </label>
        </div>

        <div className="results-count">
          {projectsLoading ? 'Loading projects…' : `${filteredProjects.length} projects found`}
        </div>

        {!projectsLoading && filteredProjects.length === 0 ? (
          <div className="empty-state">
            <h2>No matching projects</h2>
            <p>Try a broader search or publish the first project in this category.</p>
          </div>
        ) : null}

        <div className="project-grid">
          {filteredProjects.map((project) => (
            <ProjectCard key={`${project.source || 'seed'}-${project.id}`} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExplorePage;
