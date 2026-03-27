import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/react';
import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import ProjectPage from './pages/ProjectPage';
import PublishPage from './pages/PublishPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import { isSupabaseConfigured, useSupabaseClient } from './lib/supabase';
import { fetchProjects, forkProject, publishProject } from './services/projects';

function App() {
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const [remoteProjects, setRemoteProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      if (!isSupabaseConfigured() || !supabase) {
        if (isMounted) {
          setRemoteProjects([]);
          setProjectsLoading(false);
          setProjectsError('');
        }
        return;
      }

      setProjectsLoading(true);
      setProjectsError('');

      try {
        const projects = await fetchProjects(supabase, user?.id);
        if (isMounted) setRemoteProjects(projects);
      } catch (error) {
        if (isMounted) setProjectsError(error.message || 'Could not load projects from Supabase.');
      } finally {
        if (isMounted) setProjectsLoading(false);
      }
    }

    loadProjects();
    return () => {
      isMounted = false;
    };
  }, [supabase, user?.id]);

  async function handlePublishProject(formState, archiveFile) {
    const project = await publishProject({ supabase, user, formState, archiveFile });
    setRemoteProjects((current) => [project, ...current]);
    return project;
  }

  async function handleForkProject(project) {
    const clonedProject = await forkProject({ supabase, user, project });
    setRemoteProjects((current) => [clonedProject, ...current]);
    return clonedProject;
  }

  const recentProjects = useMemo(() => remoteProjects.slice(0, 3), [remoteProjects]);
  const userProjects = useMemo(() => remoteProjects.filter((project) => project.isUserProject), [remoteProjects]);

  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                projectCount={remoteProjects.length}
                recentProjects={recentProjects}
                isSupabaseConfigured={isSupabaseConfigured()}
                projectsLoading={projectsLoading}
              />
            }
          />
          <Route
            path="/explore"
            element={
              <ExplorePage
                projects={remoteProjects}
                isSupabaseConfigured={isSupabaseConfigured()}
                projectsLoading={projectsLoading}
                projectsError={projectsError}
              />
            }
          />
          <Route
            path="/project/:projectId"
            element={
              <ProjectPage
                projects={remoteProjects}
                onForkProject={handleForkProject}
                isSupabaseConfigured={isSupabaseConfigured()}
              />
            }
          />
          <Route
            path="/publish"
            element={
              <PublishPage
                onPublishProject={handlePublishProject}
                isSupabaseConfigured={isSupabaseConfigured()}
              />
            }
          />
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                userProjects={userProjects}
                isSupabaseConfigured={isSupabaseConfigured()}
                projectsLoading={projectsLoading}
                projectsError={projectsError}
              />
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
