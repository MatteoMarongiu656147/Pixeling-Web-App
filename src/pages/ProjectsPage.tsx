
/** Displays all downloadable projects stored in Firestore. */
import { useEffect, useState } from 'react';
import ProjectGrid from '../components/project/ProjectGrid';
import { getAllProjects } from '../services/projectService';
import type { Project } from '../types/project';

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Project documents include a preview URL; the Base64 file is only used on download.
  useEffect(() => {
    let isActive = true;

    async function loadProjects() {
      try {
        const loadedProjects = await getAllProjects();
        if (isActive) setProjects(loadedProjects);
      } catch (error) {
        if (isActive) {
          console.error('Unable to load projects:', error);
          setErrorMessage('Unable to load projects. Please try again.');
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadProjects();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="main-content">
      <section className="discover">
        <div>
          <h1>Download Projects.</h1>
        </div>

        <p className="section-description">
          Browse pixel art resources and download individual files.
        </p>

        {isLoading ? (
          <p className="section-description">Loading projects...</p>
        ) : errorMessage ? (
          <p className="section-description" role="alert">{errorMessage}</p>
        ) : projects.length === 0 ? (
          <p className="section-description">No projects have been published yet.</p>
        ) : (
          <ProjectGrid projects={projects} />
        )}
      </section>
    </main>
  );
}

export default ProjectsPage;
