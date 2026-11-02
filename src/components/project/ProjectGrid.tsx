
/**
 * Displays a grid of project cards provided by the parent component.
 */
import type { Project } from '../../types/project';
import ProjectCard from './ProjectCard';

// The component takes an array of Projects as a prop, and an optional function onDelete
// that takes the ID of the project as a parameter and returns nothing.
// The onDelete function is passed to ProjectGrid from the ProfilePage if the profile shown
// is the one of the logged user.
function ProjectGrid(props: {
  projects: Project[];
  onDelete?: (projectId: string) => void;
}) {
  const projects = props.projects;

  return (
    <div className="artwork-grid">
      {projects.map((currentProject) => (
        <ProjectCard
          key={currentProject.id}
          project={currentProject}
          onDelete={props.onDelete}
        />
      ))}
    </div>
  );
}

export default ProjectGrid;
