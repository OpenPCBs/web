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
          <h1>Browse public PCB projects</h1>
          <p>
            Search live projects by keyword, tag, tool, or category. This page now shows
            only real data from your configured backend.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="status-banner status-banner-warning">
            Supabase is not configured yet, so no public project catalog can load.
          </div>
        ) : null}

        {projectsError ? <div className="status-banner status-banner-error">{projectsError}</div> : null}

        <div className="filters-shell">
          <label className="filter-field">
            <span>Search</span>
            <input type="text" placeholder="RFID, audio, buck converter..." value={query} onChange={(event) => setQuery(event.target.value)} />
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
            <p>Try a broader search, or publish the first project in this category.</p>
          </div>
        ) : null}

        <div className="project-grid">
          {filteredProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      </div>
    </section>
  );
}

export default ExplorePage;
